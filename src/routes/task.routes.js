const express = require("express");
const { tasksService } = require("../services/task.service");

const tasksRoute = express.Router();

tasksRoute.post("/", async (req, res) => {
  try {
    const { title, description, due_date, due_time, status, owner_id: bodyOwner } = req.body;
    const owner_id = (req.user && req.user.sub) || bodyOwner;

    if (!owner_id || !title) {
      return res.status(400).json({ ok: false, error: "missing_owner_or_title" });
    }

    const task = await tasksService.createTask({
      owner_id,
      title,
      description,
      due_date,
      due_time,
      status,
    });

    return res.status(201).json({ ok: true, task });
  } catch (err) {
    console.error("[tasksRoute.create]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

tasksRoute.get("/day", async (req, res) => {
  try {
    const { date, owner_id: queryOwner } = req.query;
    const owner_id = (req.user && req.user.sub) || queryOwner;

    if (!owner_id || !date) {
      return res.status(400).json({ ok: false, error: "missing_owner_or_date" });
    }

    const tasks = await tasksService.listTasksForDay(owner_id, date);
    return res.json({ ok: true, tasks });
  } catch (err) {
    console.error("[tasksRoute.listForDay]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

tasksRoute.get("/range", async (req, res) => {
  try {
    const { start, end, owner_id: queryOwner } = req.query;
    const owner_id = (req.user && req.user.sub) || queryOwner;

    if (!owner_id || !start || !end) {
      return res.status(400).json({ ok: false, error: "missing_owner_or_range" });
    }

    const tasks = await tasksService.listTasksForRange(owner_id, start, end);
    return res.json({ ok: true, tasks });
  } catch (err) {
    console.error("[tasksRoute.listForRange]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

tasksRoute.patch("/:task_id/done", async (req, res) => {
  try {
    const { task_id } = req.params;
    const owner_id = (req.user && req.user.sub) || req.body.owner_id;

    if (!owner_id || !task_id) {
      return res.status(400).json({ ok: false, error: "missing_owner_or_task_id" });
    }

    const task = await tasksService.markTaskDone(owner_id, task_id);
    if (!task) {
      return res.status(404).json({ ok: false, error: "task_not_found" });
    }

    return res.json({ ok: true, task });
  } catch (err) {
    console.error("[tasksRoute.markDone]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

tasksRoute.patch("/:task_id/snooze", async (req, res) => {
  try {
    const { task_id } = req.params;
    const { new_due_date, new_due_time, owner_id: bodyOwner } = req.body;
    const owner_id = (req.user && req.user.sub) || bodyOwner;

    if (!owner_id || !task_id) {
      return res.status(400).json({ ok: false, error: "missing_owner_or_task_id" });
    }

    const task = await tasksService.snoozeTask(
      owner_id,
      task_id,
      new_due_date,
      new_due_time,
    );

    if (!task) {
      return res.status(404).json({ ok: false, error: "task_not_found" });
    }

    return res.json({ ok: true, task });
  } catch (err) {
    console.error("[tasksRoute.snooze]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = { tasksRoute };