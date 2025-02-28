class TaskRunnerService {
  async runTask(taskId) {
    console.log(`Running task ${ taskId }`);
  }
}

module.exports = new TaskRunnerService();
