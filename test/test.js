/* eslint-env mocha */
/* eslint object-property-newline: "off" */
'use strict'

const assert = require('chai').assert
const expect = require('chai').expect

const DependentTaskRunner = require('../')

function logTasksAndResults (taskLog, resultLog, id, taskTimeMs, err) {
  return function (results) {
    taskLog.push(`start ${ id }`)
    resultLog[id] = results
    return new Promise(resolve => {
      if (err) {
        throw new Error(err)
      }
      setTimeout(
        () => {
          taskLog.push(`end ${ id }`)
          resolve(`${ id }-result`)
        },
        taskTimeMs)
    })
  }
}

describe('task order and results', () => {
  it('no tasks', () => {
    const taskRunner = new DependentTaskRunner()

    return taskRunner.run()
  })

  it('task with one dependency', () => {
    const taskRunner = new DependentTaskRunner()
    const taskLog = []
    const taskResults = {}

    taskRunner
      .addTask(
        { id: 'A', depends: 'B' },
        logTasksAndResults(taskLog, taskResults, 'A', 10)
      )
      .addTask(
        { id: 'B' },
        logTasksAndResults(taskLog, taskResults, 'B', 10)
      )

    return taskRunner.run().then(result => {
      assert.deepEqual(taskLog, [
        'start B',
        'end B',
        'start A',
        'end A',
      ])
      assert.deepEqual(taskResults, {
        A: { B: 'B-result' },
        B: { },
      })
      assert.deepEqual(result, {
        A: 'A-result',
        B: 'B-result',
      })
    })
  })

  it('task with multiple dependencies', () => {
    const taskRunner = new DependentTaskRunner()
    const taskLog = []
    const taskResults = {}

    taskRunner
      .addTask(
        { id: 'A', depends: [ 'B', 'C', 'F' ] },
        logTasksAndResults(taskLog, taskResults, 'A', 10)
      )
      .addTask(
        { id: 'B' },
        logTasksAndResults(taskLog, taskResults, 'B', 10)
      )
      .addTask(
        { id: 'C' },
        logTasksAndResults(taskLog, taskResults, 'C', 30)
      )
      .addTask(
        { id: 'F' },
        logTasksAndResults(taskLog, taskResults, 'F', 20)
      )

    return taskRunner.run().then(result => {
      assert.deepEqual(taskLog, [
        'start B',
        'start C',
        'start F',
        'end B',
        'end F',
        'end C',
        'start A',
        'end A',
      ])
      assert.deepEqual(taskResults, {
        A: { B: 'B-result', C: 'C-result', F: 'F-result' },
        B: { },
        C: { },
        F: { },
      })
      assert.deepEqual(result, {
        A: 'A-result',
        B: 'B-result',
        C: 'C-result',
        F: 'F-result',
      })
    })
  })

  it('independent tasks', () => {
    const taskRunner = new DependentTaskRunner()
    const taskLog = []
    const taskResults = {}

    taskRunner
      .addTask(
        { id: 'A', depends: [ 'B' ] },
        logTasksAndResults(taskLog, taskResults, 'A', 20)
      )
      .addTask(
        { id: 'B' },
        logTasksAndResults(taskLog, taskResults, 'B', 10)
      )
      .addTask(
        { id: 'F', depends: 'Q' },
        logTasksAndResults(taskLog, taskResults, 'F', 20)
      )
      .addTask(
        { id: 'Q' },
        logTasksAndResults(taskLog, taskResults, 'Q', 20)
      )

    return taskRunner.run().then(result => {
      assert.deepEqual(taskLog, [
        'start B',
        'start Q',
        'end B',
        'start A',
        'end Q',
        'start F',
        'end A',
        'end F',
      ])
      assert.deepEqual(taskResults, {
        A: { B: 'B-result' },
        B: { },
        F: { Q: 'Q-result' },
        Q: { },
      })
      assert.deepEqual(result, {
        A: 'A-result',
        B: 'B-result',
        F: 'F-result',
        Q: 'Q-result',
      })
    })
  })

  it('tree of dependencies', () => {
    const taskRunner = new DependentTaskRunner()
    const taskLog = []
    const taskResults = {}

    taskRunner
      .addTask(
        { id: 'E', depends: [ 'A', 'B' ] },
        logTasksAndResults(taskLog, taskResults, 'E', 10)
      )
      .addTask(
        { id: 'A', depends: [ 'C', 'B', 'F' ] },
        logTasksAndResults(taskLog, taskResults, 'A', 10)
      )
      .addTask(
        { id: 'B', depends: [ 'F' ] },
        logTasksAndResults(taskLog, taskResults, 'B', 10)
      )
      .addTask(
        { id: 'C', depends: [ 'F' ] },
        logTasksAndResults(taskLog, taskResults, 'C', 20)
      )
      .addTask(
        { id: 'F' },
        logTasksAndResults(taskLog, taskResults, 'F', 10)
      )

    return taskRunner.run().then(result => {
      assert.deepEqual(taskLog, [
        'start F',
        'end F',
        'start B',
        'start C',
        'end B',
        'end C',
        'start A',
        'end A',
        'start E',
        'end E',
      ])
      assert.deepEqual(taskResults, {
        E: { A: 'A-result', B: 'B-result' },
        A: { C: 'C-result', B: 'B-result', F: 'F-result' },
        B: { F: 'F-result' },
        C: { F: 'F-result' },
        F: { },
      })
      assert.deepEqual(result, {
        E: 'E-result',
        A: 'A-result',
        B: 'B-result',
        C: 'C-result',
        F: 'F-result',
      })
    })
  })
})

describe('errors', () => {
  it('same task ID defined twice', () => {
    const taskRunner = new DependentTaskRunner()

    const testFunc = () => taskRunner
      .addTask(
        { id: 'A' },
        () => 'empty'
      )
      .addTask(
        { id: 'A' },
        () => 'empty'
      )
    expect(testFunc).to.throw("task 'A' has already been added")
  })

  it('dependent task not defined', () => {
    const taskRunner = new DependentTaskRunner()

    taskRunner
      .addTask(
        { id: 'A', depends: 'B' },
        () => 'empty'
      )
    return taskRunner.run()
      .then(() => {
        assert.fail('should have rejected with an error')
      })
      .catch(err => {
        expect(err.message).to.match(/task 'B' has not been defined/)
      })
  })

  it('task function is not given', () => {
    const taskRunner = new DependentTaskRunner()

    const testFunc = () => taskRunner
      .addTask(
        { id: 'A' }
        // missing function here
      )
    expect(testFunc).to.throw("no function provided for task 'A'")
  })

  it('simple circular dependency', () => {
    const taskRunner = new DependentTaskRunner()

    const testFunc = () => taskRunner
      .addTask(
        { id: 'A', depends: 'B' },
        () => 'empty'
      )
      .addTask(
        { id: 'B', depends: 'A' }, // this creates the circular dep
        () => 'empty'
      )
    expect(testFunc).to.throw('circular dependency detected: A --> B --> A')
  })

  it('larger circular dependency, added out of order', () => {
    const taskRunner = new DependentTaskRunner()
    const taskLog = []
    const taskResults = {}

    const testFunc = () => taskRunner
      .addTask(
        { id: 'A', depends: 'B' },
        logTasksAndResults(taskLog, taskResults, 'A', 10)
      )
      .addTask(
        { id: 'C', depends: 'D' },
        logTasksAndResults(taskLog, taskResults, 'C', 10)
      )
      .addTask(
        { id: 'B', depends: [ 'C' ] },
        logTasksAndResults(taskLog, taskResults, 'B', 10)
      )
      .addTask(
        { id: 'D', depends: 'A' }, // this creates the circular dep
        logTasksAndResults(taskLog, taskResults, 'D', 10)
      )

    expect(testFunc).to.throw('circular dependency detected: A --> D --> C --> B --> A')
  })
})

describe('task errors', () => {
  it('running tasks run to completion', () => {
    const taskRunner = new DependentTaskRunner()
    const taskLog = []
    const taskResults = {}

    taskRunner
      .addTask(
        { id: 'A', depends: [ 'B', 'C', 'D' ] },
        logTasksAndResults(taskLog, taskResults, 'A', 10)
      )
      .addTask(
        { id: 'B' },
        logTasksAndResults(taskLog, taskResults, 'B', 10, 'some error')
      )
      .addTask(
        { id: 'C' },
        logTasksAndResults(taskLog, taskResults, 'C', 30)
      )
      .addTask(
        { id: 'D' },
        logTasksAndResults(taskLog, taskResults, 'D', 20)
      )

    return taskRunner.run()
      .catch(e => {
        expect(e).to.match(/some error/)
      })
      .then(() => {
        assert.deepEqual(taskLog, [
          'start B',
          'start C',
          'start D',
          'end D',
          'end C',
        ])
        assert.deepEqual(taskResults, {
          B: { },
          C: { },
          D: { },
        })
      })
  })

  it('for multiple errors only the first error is returned', () => {
    const taskRunner = new DependentTaskRunner()
    const taskLog = []
    const taskResults = {}

    taskRunner
      .addTask(
        { id: 'A', depends: [ 'B', 'C', 'E' ] },
        logTasksAndResults(taskLog, taskResults, 'A', 10)
      )
      .addTask(
        { id: 'B' },
        logTasksAndResults(taskLog, taskResults, 'B', 10, 'some error')
      )
      .addTask(
        { id: 'C' },
        logTasksAndResults(taskLog, taskResults, 'C', 30)
      )
      .addTask(
        { id: 'E', depends: 'D' },
        logTasksAndResults(taskLog, taskResults, 'E', 10, 'another error')
      )
      .addTask(
        { id: 'D' },
        logTasksAndResults(taskLog, taskResults, 'D', 10)
      )

    return taskRunner.run()
      .catch(e => {
        expect(e).to.match(/some error/)
      })
      .then(() => {
        assert.deepEqual(taskLog, [
          'start B',
          'start C',
          'start D',
          'end D',
          'start E',
          'end C',
        ])
        assert.deepEqual(taskResults, {
          B: { },
          C: { },
          D: { },
          E: { D: 'D-result' },
        })
      })
  })
})
