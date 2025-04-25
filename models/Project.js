const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teams: [
      {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Team",
        },
        role: {
          type: String,
          enum: ["lead", "contributor", "viewer"],
          default: "contributor",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    activityLogs: [
      {
        action: {
          type: String,
          required: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        details: {
          type: mongoose.Schema.Types.Mixed,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
ProjectSchema.index({ owner: 1 });
ProjectSchema.index({ status: 1 });

// Middleware to update the updatedAt field
ProjectSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Ensure the owner is always a member
ProjectSchema.pre("save", function (next) {
  if (this.owner && !this.teams.some(team => team.team.toString() === this.owner.toString())) {
    this.teams.push({ team: this.owner, role: "lead" });
  }
  next();
});

const Project = mongoose.model("Project", ProjectSchema);

module.exports = Project;
