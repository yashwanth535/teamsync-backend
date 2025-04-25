const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Project = require("../models/Project");
const User = require("../models/User");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const Event = require("../models/Event");

// @route   GET /api/dashboard
// @desc    Get dashboard data
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    // Get user information
    const userId = req.user.id;

    // Get total projects count
    const totalProjects = await Project.countDocuments({
      $or: [{ owner: userId }, { "teams.team": userId }],
    });

    // Get team members count for projects user is part of
    const userProjects = await Project.find({
      $or: [{ owner: userId }, { "teams.team": userId }],
    });
    const projectIds = userProjects.map((project) => project._id);

    // Get recent projects
    const recentProjects = await Project.find({
      $or: [{ owner: userId }, { "teams.team": userId }],
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("owner", "name email")
      .populate("teams.team", "name");

    // Format project data for the frontend
    const formattedProjects = recentProjects.map((project) => ({
      id: project._id,
      title: project.title,
      description: project.description,
      status: project.status,
      progress: project.progress,
      owner: project.owner ? {
        id: project.owner._id,
        name: project.owner.name,
        email: project.owner.email,
      } : null,
      teams: project.teams
        .filter(team => team.team) // Filter out null team references
        .map((team) => ({
          id: team.team._id,
          name: team.team.name,
          role: team.role,
        })),
    }));

    // Get recent activities
    const recentActivities = await Activity.find({
      $or: [{ user: userId }, { project: { $in: projectIds } }],
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate("user", "name email");

    // Format activities data for the frontend
    const formattedActivities = recentActivities.map((activity) => ({
      id: activity._id,
      type: activity.type,
      description: activity.description,
      timestamp: activity.timestamp,
      user: activity.user ? {
        id: activity.user._id,
        name: activity.user.name,
        email: activity.user.email,
      } : null,
    }));

    // Get upcoming events
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const upcomingEvents = await Event.find({
      date: { $gte: today, $lte: thirtyDaysFromNow },
      $or: [{ organizer: userId }, { attendees: userId }],
    })
      .sort({ date: 1 })
      .limit(5);

    // Format events data for the frontend
    const formattedEvents = upcomingEvents.map((event) => ({
      id: event._id,
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
    }));

    // Compile dashboard data
    const dashboardData = {
      stats: {
        totalProjects,
        totalTeamMembers: recentProjects.reduce((acc, project) => 
          acc + project.teams.filter(team => team.team).length, 0),
        activeProjects: await Project.countDocuments({
          $or: [{ owner: userId }, { "teams.team": userId }],
          status: "active",
        }),
        completedTasks: await Task.countDocuments({
          $or: [{ assignedTo: userId }, { createdBy: userId }],
          status: "completed",
        }),
      },
      recentProjects: formattedProjects,
      recentActivities: formattedActivities,
      upcomingEvents: formattedEvents,
    };

    res.json(dashboardData);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ 
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
