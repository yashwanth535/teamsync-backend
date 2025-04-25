const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Project = require("../models/Project");
const auth = require("../middleware/auth");
const bcrypt = require('bcryptjs');

// Get all tasks for a project
router.get("/project/:projectId", auth, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Get task by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    if (!task) {
      return res.status(404).json({ msg: "Task not found" });
    }

    // Check if user has access to the task's project
    const project = await Project.findById(task.project);
    if (
      project.owner.toString() !== req.user.id &&
      !project.members.includes(req.user.id) &&
      !project.team?.members.includes(req.user.id)
    ) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    res.json(task);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Task not found" });
    }
    res.status(500).send("Server Error");
  }
});

// Create task (Leader only)
router.post("/", auth, async (req, res) => {
  try {
    const { title, description, deadline, priority, accessPassword } = req.body;

    // Hash the access password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(accessPassword, salt);

    const task = new Task({
      title,
      description,
      leader: req.user.id,
      deadline,
      priority,
      accessPassword: hashedPassword,
      members: [{ user: req.user.id, role: 'leader' }]
    });

    await task.save();

    res.status(201).json({
      success: true,
      task: {
        ...task.toObject(),
        accessCode: task.accessCode // Include access code in response
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating task'
    });
  }
});

// Join task
router.post("/join", auth, async (req, res) => {
  try {
    const { accessCode, accessPassword } = req.body;

    const task = await Task.findOne({ accessCode });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(accessPassword, task.accessPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid access password'
      });
    }

    // Check if user is already a member
    if (task.members.some(member => member.user.toString() === req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this task'
      });
    }

    // Add user to members
    task.members.push({ user: req.user.id });
    await task.save();

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error joining task'
    });
  }
});

// Get user's tasks
router.get("/", auth, async (req, res) => {
  try {
    const tasks = await Task.find({
      'members.user': req.user.id
    }).populate('members.user', 'name email');

    res.json({
      success: true,
      tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks'
    });
  }
});

// Update task
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedTo } =
      req.body;

    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ msg: "Task not found" });
    }

    // Check if user has access to the task's project
    const project = await Project.findById(task.project);
    if (
      project.owner.toString() !== req.user.id &&
      !project.members.includes(req.user.id)
    ) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { title, description, status, priority, dueDate, assignedTo } },
      { new: true }
    );

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Delete task
router.delete("/:id", auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ msg: "Task not found" });
    }

    // Check if user has access to the task's project
    const project = await Project.findById(task.project);
    if (
      project.owner.toString() !== req.user.id &&
      !project.members.includes(req.user.id)
    ) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    // Remove task from project's tasks array
    project.tasks = project.tasks.filter(
      (taskId) => taskId.toString() !== req.params.id
    );
    await project.save();

    await task.remove();

    res.json({ msg: "Task removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
