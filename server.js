const express = require("express");
const { Server } = require("socket.io");
const { createServer } = require("http");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());

// Create HTTP server
const server = createServer(app);

// Create a Socket.IO server and pass the HTTP server to it
const io = new Server(server, {
  cors: {
    origin: "*", // Frontend URL
    methods: ["GET", "POST"],
  },
});

let availableExecutives = []; // List of available customer care executives
let clientsToExecutives = {}; // Map to track which client is connected to which executive

// Root endpoint
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Handle socket connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Listen for "registerExecutive" to mark a user as a customer care executive
  socket.on("registerExecutive", () => {
    console.log(`Executive joined: ${socket.id}`);
    availableExecutives.push(socket.id); // Add the executive to the available list
  });

  // Listen for "registerClient" to mark a user as a client
  socket.on("registerClient", () => {
    console.log(`Client joined: ${socket.id}`);
    if (availableExecutives.length > 0) {
      // Assign an executive to the client
      const assignedExecutive = availableExecutives.shift(); // Remove the executive from the available list
      clientsToExecutives[socket.id] = assignedExecutive;
      io.to(assignedExecutive).emit("clientAssigned", socket.id); // Notify the executive of the client assignment
      // Notify the client and executive of the connection
      io.to(socket.id).emit("message", {
        role: "Support",
        content: `You have been connected to an executive`,
      });
      io.to(assignedExecutive).emit("message", {
        role: "Support",
        content: `You have been assigned a client: ${socket.id}`,
      });
    } else {
    }
  });

  // Handle messages from clients
  socket.on("message", (msg) => {
    console.log(`Message received from ${socket.id}: ${msg.content}`);
    if (!availableExecutives.length > 0 && !clientsToExecutives[socket.id]) {
      io.to(socket.id).emit("message", {
        role: "Support",
        content: `Executive is not available. Please wait.`,
      });
    }

    if (clientsToExecutives[socket.id] && !msg.role === "user") {
      // Check if it's a client and send the message to their assigned executive
      const assignedExecutive = clientsToExecutives[socket.id];
      io.to(assignedExecutive).emit("message", msg);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Check if the disconnected user was an executive or client
    if (availableExecutives.includes(socket.id)) {
      // If it was an executive, remove them from the available list
      availableExecutives = availableExecutives.filter(
        (execId) => execId !== socket.id
      );
      console.log(`Executive ${socket.id} removed from available list`);
    } else if (clientsToExecutives[socket.id]) {
      // If it was a client, notify their assigned executive
      const assignedExecutive = clientsToExecutives[socket.id];
      io.to(assignedExecutive).emit("message", {
        role: "Support",
        content: `Your client ${socket.id} has disconnected.`,
      });

      // Remove the client from the mapping
      delete clientsToExecutives[socket.id];
    }
  });
});

// Start the server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Server is running on port " + port);
});
