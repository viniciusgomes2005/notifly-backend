const { client } = require("../database/client");

const tasksService = {
  async createTask({ owner_id, title, description, due_date, due_time, status }) {
    const { data, error } = await client
      .from("tasks")
      .insert({
        owner_id,
        title,
        description: description ?? null,
        due_date: due_date ?? null,
        due_time: due_time ?? null,
        status: status ?? "pending",
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async listTasksForDay(owner_id, date) {
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .eq("owner_id", owner_id)
      .eq("due_date", date)
      .order("due_date", { ascending: true })
      .order("due_time", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async listTasksForRange(owner_id, start, end) {
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .eq("owner_id", owner_id)
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date", { ascending: true })
      .order("due_time", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async markTaskDone(owner_id, task_id) {
    const { data, error } = await client
      .from("tasks")
      .update({
        status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("task_id", task_id)
      .eq("owner_id", owner_id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async snoozeTask(owner_id, task_id, new_due_date, new_due_time) {
    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (new_due_date) updatePayload.due_date = new_due_date;
    if (new_due_time) updatePayload.due_time = new_due_time;

    const { data, error } = await client
      .from("tasks")
      .update(updatePayload)
      .eq("task_id", task_id)
      .eq("owner_id", owner_id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};

module.exports = { tasksService };