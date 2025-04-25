const Notification = require("../models/Notification");

const sendNotification = async (
  io,
  { recipient, sender, type, message, link, metadata = {} }
) => {
  try {
    // Create notification in database
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      message,
      link,
      metadata,
    });

    // Populate sender information
    await notification.populate("sender", "name avatar");

    // Emit notification to recipient's room
    io.to(recipient.toString()).emit("notification", notification);

    return notification;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
};

module.exports = {
  sendNotification,
};
