const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "task_created",
      "task_updated",
      "task_completed",
      "project_created",
      "project_updated",
      "user_joined",
      "new_comment",
      "deadline_updated",
      "priority_changed",
    ],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
  },
});

module.exports = mongoose.model("Activity", ActivitySchema);
