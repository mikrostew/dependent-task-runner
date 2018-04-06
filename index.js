'use strict'

function runTasks (tasks) {
  let error
  const results = {}
  return Promise.all(
    tasks.map(task => runTask(task)
      .then(taskResult => {
        results[task.id] = taskResult
        const readyToRun = task.children.filter(updateChildTask(task.id, taskResult))
        if (readyToRun.length > 0) {
          return runTasks(readyToRun).then(res => Object.assign(results, res))
        }
      })
      .catch(err => {
        // if there were multiple task erros, only return the first one
        // let tasks run to completion before rejecting
        if (!error) {
          error = err
        }
      })
    )
  ).then(() => error ? Promise.reject(error) : results)
}

function runTask (task) {
  return new Promise((resolve, reject) => {
    if (typeof task.run === 'function') {
      resolve(task.run(task.resultsFromDependents))
    }
    reject(new Error(`task '${task.id}' has not been defined`))
  })
}

function updateChildTask (id, result) {
  return function updateAndRun (child) {
    // dependent tasks get the results from the parent task
    child.resultsFromDependents[id] = result
    child.deps -= 1
    // if all dependent tasks have finished, this can be run
    return child.deps === 0
  }
}

function propagateDownstreamInfo (task) {
  Object.keys(task.parents).forEach(parentId => {
    Object.assign(task.parents[parentId].allDownstream, task.allDownstream)
    propagateDownstreamInfo(task.parents[parentId])
  })
}

function getPath (task, targetId) {
  if (task.id === targetId) {
    return [ targetId ]
  }
  const childs = task.children.filter(child => child.allDownstream[targetId] !== undefined)
  if (childs.length > 0) {
    return [ task.id ].concat(getPath(childs[0], targetId))
  }
  return []
}

function createTask (taskId, taskFunction) {
  return {
    id: taskId,
    children: [], // tasks that depend on this task
    parents: {}, // tasks that this depends on
    deps: 0, // count of things this depends on (that haven't run yet)
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
      let depTask = this.tasks[dep]
      if (!depTask) {
        // create a placeholder task until it is added
        depTask = this.tasks[dep] = createTask(dep, undefined) // no function for placeholder
      }
      depTask.children.push(newTask)
      newTask.deps += 1
      newTask.parents[dep] = depTask

      // track downstream dependencies to detect cycles
      depTask.allDownstream[newTask.id] = true
      Object.assign(depTask.allDownstream, newTask.allDownstream)
      if (depTask.allDownstream[dep]) {
        const cycle = [ depTask.id ].concat(getPath(newTask, depTask.id)).join(' --> ')
        throw new Error('circular dependency detected: ' + cycle)
      }
      propagateDownstreamInfo(depTask)
    })

    // allow chained calls
    return this
  }

  run () {
    // tasks with no dependencies can be run first
    const canRun = Object.keys(this.tasks)
      .map(taskId => this.tasks[taskId])
      .filter(task => task.deps === 0)
    return runTasks(canRun)
  }
}

module.exports = DependentTaskRunner
