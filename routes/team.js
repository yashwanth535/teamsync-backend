import express from "express";
import { body, validationResult } from "express-validator";
import Team from "../models/Team.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import Project from "../models/Project.js";

const router = express.Router();


// Get all teams for current user
router.get("/", auth, async (req, res) => {
  try {
    const teams = await Team.find({
      "members.user": req.user.id
    }).populate("members.user", "name email role")
      .populate("projects", "title description")
      .populate("tasks", "title status");
    
    res.json(teams);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Get team by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate("members.user", "name email role")
      .populate("projects", "title description")
      .populate("tasks", "title status")
      .populate("activityLogs.user", "name");
      
    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    // Check if user is a member of the team
    const isMember = team.members.some(member => 
      member.user._id.toString() === req.user.id
    );
    if (!isMember) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Create new team
router.post(
  "/",
  [
    auth,
    [
      body("name", "Name is required").not().isEmpty(),
      body("description", "Description is required").not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, description, projectId } = req.body;

      // Check if team name exists
      let team = await Team.findOne({ name });
      if (team) {
        return res.status(400).json({ msg: "Team name already exists" });
      }

      // Create new team
      team = new Team({
        name,
        description,
        members: [{
          user: req.user.id,
          role: "lead"
        }],
        projects: projectId ? [projectId] : [],
        activityLogs: [{
          action: "team_created",
          user: req.user.id,
          details: { name, description }
        }]
      });

      await team.save();

      // Add team to user's teams
      await User.findByIdAndUpdate(req.user.id, {
        $push: { teams: team._id }
      });

      res.json(team);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// Join team by code
router.post("/join", auth, async (req, res) => {
  try {
    const { joinCode } = req.body;
    
    const team = await Team.findOne({ joinCode });
    if (!team) {
      return res.status(404).json({ msg: "Invalid join code" });
    }

    // Check if user is already a member
    const isMember = team.members.some(member => 
      member.user.toString() === req.user.id
    );
    if (isMember) {
      return res.status(400).json({ msg: "Already a member of this team" });
    }

    // Add user to team
    team.members.push({
      user: req.user.id,
      role: "contributor"
    });

    // Add activity log
    team.activityLogs.push({
      action: "member_joined",
      user: req.user.id,
      details: { joinCode }
    });

    await team.save();

    // Add team to user's teams
    await User.findByIdAndUpdate(req.user.id, {
      $push: { teams: team._id }
    });

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Update team
router.put("/:id", auth, async (req, res) => {
  const { name, description } = req.body;

  try {
    let team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    // Check if user is a member of the team
    if (!team.members.includes(req.user.id)) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    team = await Team.findByIdAndUpdate(
      req.params.id,
      { $set: { name, description } },
      { new: true }
    );

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Add member to team
router.post("/:id/members", auth, async (req, res) => {
  try {
    const { email, role = "contributor" } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    // Check if user is a team lead
    const isLead = team.members.some(member => 
      member.user.toString() === req.user.id && member.role === "lead"
    );
    if (!isLead) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Check if user is already a member
    const isMember = team.members.some(member => 
      member.user.toString() === user._id.toString()
    );
    if (isMember) {
      return res.status(400).json({ msg: "User is already a member" });
    }

    // Add user to team
    team.members.push({
      user: user._id,
      role
    });

    // Add activity log
    team.activityLogs.push({
      action: "member_added",
      user: req.user.id,
      details: { addedUser: user._id, role }
    });

    await team.save();

    // Add team to user's teams
    await User.findByIdAndUpdate(user._id, {
      $push: { teams: team._id }
    });

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Update team member role
router.put("/:id/members/:userId", auth, async (req, res) => {
  try {
    const { role } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    // Check if user is a team lead
    const isLead = team.members.some(member => 
      member.user.toString() === req.user.id && member.role === "lead"
    );
    if (!isLead) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    // Update member role
    const memberIndex = team.members.findIndex(member => 
      member.user.toString() === req.params.userId
    );
    if (memberIndex === -1) {
      return res.status(404).json({ msg: "Member not found" });
    }

    team.members[memberIndex].role = role;

    // Add activity log
    team.activityLogs.push({
      action: "role_updated",
      user: req.user.id,
      details: { userId: req.params.userId, newRole: role }
    });

    await team.save();
    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Remove member from team
router.delete("/:id/members/:userId", auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    // Check if user is a team lead
    const isLead = team.members.some(member => 
      member.user.toString() === req.user.id && member.role === "lead"
    );
    if (!isLead) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    // Remove user from team
    team.members = team.members.filter(
      member => member.user.toString() !== req.params.userId
    );

    // Add activity log
    team.activityLogs.push({
      action: "member_removed",
      user: req.user.id,
      details: { removedUser: req.params.userId }
    });

    await team.save();

    // Remove team from user's teams
    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { teams: team._id }
    });

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Delete team
router.delete("/:id", auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    // Check if user is a member of the team
    if (!team.members.includes(req.user.id)) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    // Remove team from all members' teams
    await User.updateMany(
      { _id: { $in: team.members } },
      { $pull: { teams: team._id } }
    );

    await team.remove();
    res.json({ msg: "Team removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/team
// @desc    Get team members
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    // Get project count for each user
    const teamMembers = await Promise.all(
      users.map(async (user) => {
        const projectCount = await Project.countDocuments({ members: user._id });
        return {
          ...user.toObject(),
          projectCount
        };
      })
    );

    res.json(teamMembers);
  } catch (error) {
    console.error('Team Error:', error);
    res.status(500).send('Server Error');
  }
});

// Get team activity
router.get("/:id/activity", auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .select("activityLogs members")
      .populate("activityLogs.user", "name email")
      .populate("members.user", "name email");

    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    // Check if user is a member of the team
    const isMember = team.members && team.members.some(member => 
      member.user && member.user._id.toString() === req.user.id
    );
    
    if (!isMember) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    res.json(team.activityLogs || []);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

export default router;
