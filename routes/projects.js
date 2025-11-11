import express from "express";
const router = express.Router();
import Project from "../models/Project.js";
import Team from "../models/Team.js";
import auth from "../middleware/auth.js";


// Get all projects for current user
router.get("/", auth, async (req, res) => {
  try {
    console.log("Fetching projects for user:", req.user.id);
    // Find projects where user is either owner or member of an assigned team
    const projects = await Project.find({
      $or: [
        { owner: req.user.id },
        { "teams.team": { $in: req.user.teams } }
      ]
    })
      .populate("owner", "name email")
      .populate("teams.team", "name description")
      .populate("tasks", "title status priority")
      .sort({ createdAt: -1 });

    console.log("Found projects:", projects.length);
    res.json({ data: projects });
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// Get project by ID
router.get("/:id", auth, async (req, res) => {
  try {
    console.log("Fetching project with ID:", req.params.id);
    const project = await Project.findById(req.params.id)
      .populate("owner", "name email")
      .populate("teams.team", "name description")
      .populate("tasks", "title status priority");

    if (!project) {
      console.log("Project not found");
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if user has access to the project
    const hasAccess = project.owner.toString() === req.user.id ||
      (req.user.teams && Array.isArray(req.user.teams) && 
       project.teams.some(team => 
         req.user.teams.some(userTeam => 
           userTeam.toString() === team.team.toString()
         )
       ));

    if (!hasAccess) {
      console.log("User does not have access to project");
      return res.status(401).json({ message: "Not authorized" });
    }

    console.log("Project found:", project);
    res.json({ data: project });
  } catch (err) {
    console.error("Error fetching project:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// Create new project
router.post("/", auth, async (req, res) => {
  try {
    console.log("Creating new project with data:", req.body);
    const { title, description, teams } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const project = new Project({
      title,
      description,
      owner: req.user.id,
      teams: teams ? teams.map(teamId => ({ team: teamId, role: "contributor" })) : []
    });

    console.log("Saving project:", project);
    await project.save();
    
    // Populate the response with team details
    const populatedProject = await Project.findById(project._id)
      .populate("owner", "name email")
      .populate("teams.team", "name description");

    console.log("Project created successfully:", populatedProject);
    res.json({ data: populatedProject });
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

// Add team to project
router.post("/:id/teams", auth, async (req, res) => {
  try {
    const { teamId, role = "contributor" } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: "Project not found" });
    }

    // Check if user is project owner
    if (project.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    // Check if team is already assigned
    if (project.teams.some(t => t.team.toString() === teamId)) {
      return res.status(400).json({ msg: "Team already assigned to project" });
    }

    project.teams.push({ team: teamId, role });
    await project.save();

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Remove team from project
router.delete("/:id/teams/:teamId", auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: "Project not found" });
    }

    // Check if user is project owner
    if (project.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    project.teams = project.teams.filter(t => t.team.toString() !== req.params.teamId);
    await project.save();

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Update project
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: "Project not found" });
    }

    // Check if user is project owner
    if (project.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    if (title) project.title = title;
    if (description) project.description = description;
    if (status) project.status = status;

    await project.save();
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Delete project
router.delete("/:id", auth, async (req, res) => {
  try {
    console.log("Attempting to delete project:", req.params.id);
    console.log("User ID:", req.user.id);

    const project = await Project.findById(req.params.id);
    if (!project) {
      console.log("Project not found");
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if user is the owner
    if (project.owner.toString() !== req.user.id) {
      console.log("User is not the owner of the project");
      return res.status(403).json({ message: "Not authorized to delete this project" });
    }

    // Delete the project
    await Project.deleteOne({ _id: req.params.id });
    console.log("Project deleted successfully");

    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ message: "Error deleting project", error: err.message });
  }
});

export default router;