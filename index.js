'use strict'

function runTasks (tasks) {
  // TODO if task fails, should let others run to completion then reject
  return Promise.all(
    tasks.map(task => new Promise((resolve, reject) => {
      if (typeof task.run === 'function') {
        resolve(task.run(task.resultsFromDependents))
      }
      reject(new Error(`task '${task.id}' has not been defined`))
    }).then(taskResult => {
      const readyToRun = []
      task.children.forEach(child => {
        // dependent tasks get the results from this task
        child.resultsFromDependents[task.id] = taskResult
        child.deps -= 1
        // once all dependent tasks have finished, the next task can be run
        if (child.deps === 0) {
          readyToRun.push(child)
        }
      })
      return runTasks(readyToRun)
    }))
  )
}

function createTask (taskId, taskFunction) {
  return {
    id: taskId,
    children: [], // things that depend on this task
    deps: 0, // things this depends on (that haven't run yet)
    run: taskFunction,
    resultsFromDependents: {}, // results from tasks this depends on
    allDownstream: {}, // all task IDs downstream of this task
  }
}

class DependentTaskRunner {
  constructor () {
    this.tasks = {}
  }

  addTask (config, taskFunction) {
    const taskId = config.id
    const dependencies = Array.isArray(config.depends) ? config.depends : [ config.depends ]
    if (typeof taskFunction !== 'function') {
      throw new Error(`no function provided for task '${taskId}'`)
    }

    let newTask

    // task may already exist (placeholder created from dependency)
    if (this.tasks[taskId]) {
      newTask = this.tasks[taskId]
      if (newTask.run) {
        // don't add the same task twice
        throw new Error(`task '${taskId}' has already been added`)
      }
      newTask.run = taskFunction
    } else {
      newTask = createTask(taskId, taskFunction)
    }

    this.tasks[taskId] = newTask

    dependencies.filter(Boolean).forEach(dep => {
      // dep --> task
      let depTask = this.tasks[dep]
      if (!depTask) {
        // create a placeholder task until it is added
        depTask = this.tasks[dep] = createTask(dep, undefined) // no function for placeholder
      }
      depTask.children.push(newTask)
      newTask.deps += 1

      depTask.allDownstream[newTask.id] = true
      Object.assign(depTask.allDownstream, newTask.allDownstream)

      if (depTask.allDownstream[dep]) {
        // TODO it would be nice to show the cycle in error msg
        throw new Error('circular dependency detected')
      }
    })

    // to allow chained calls
    return this
  }

  run () {
    const allTasks = Object.keys(this.tasks).map(taskId => this.tasks[taskId])
    // tasks with no dependencies can be run first
    const toRun = allTasks.filter(task => task.deps === 0)
    return runTasks(toRun)
    // TODO return results from the last task, or from all tasks?
  }

}

module.exports = DependentTaskRunner

