'use strict'
const http = require('http')

const poetryDesk = (req, res) => {
  let poet = ''
  if (req.body.result.parameters['poet']) {
    poet = req.body.result.parameters['poet']
  }
  // Call the poetry API
  getRandomPoemByPoet(poet).then((output) => {
    // Return the results of the poetry API to Dialogflow
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ 'speech': output, 'displayText': output }))
  }).catch((error) => {
    // If there is an error let the user know
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ 'speech': error, 'displayText': error }))
  })
}

const getRandomPoemByPoet = (poet) => {
  return new Promise((resolve, reject) => {
    let speechOutput = ''

    // neither encodeURI nor encodeURIComponent work here since GC converts spaces to %C2%A0, but the api only supports %20 or + for spaces
    const poemTitlePath = 'http://poetrydb.org/author/' + poet.replace(/\s+/, '+') + '/title'

    http.get(poemTitlePath, (res) => {
      // Handle server errors
      const { statusCode } = res
      let error
      if (statusCode !== 200) {
        error = new Error(`Request Failed - Status Code: ${statusCode}`)
        console.error(error.message)
        res.resume() // consume response data to free up memory
        speechOutput = `I'm sorry, there was an error with the poetry service - we've been notified, please try again later`
        resolve(speechOutput)
      }

      // Handle server response
      let body = '' // store the response chunks
      res.on('data', (d) => { body += d }) // accumulate response chunks
      res.on('end', () => {
        let poems = JSON.parse(body)
        if (poems.length > 0) {
          let randomPoemTitle = poems[Math.floor(Math.random()*poems.length)].title
          getPoemByTitle(randomPoemTitle).then((speechOutputData) => {
            if (speechOutputData.poemError !== false) {
              speechOutput = `This ${speechOutputData.poemLines}-line poem by ${speechOutputData.poemAuthor} is called ${speechOutputData.poemTitle}: ${speechOutputData.poemBody}`
            } else {
              // todo: try a different poem from the list
            }
          })
        } else {
          // todo: log the request
          speechOutput = `Sorry, I don't currently have any poems by ${poet}, but we'll make a note to check them out. Please try again later!`
        }
        resolve(speechOutput)
      })

      // Handle client errors
      res.on('error', (error) => {
        reject(error) // todo: do we want to resolve here instead?
      })
    })
  })
}

const getPoemByTitle = (poemTitle) => {
  return new Promise((resolve, reject) => {
    let poemError = false
    let poemAuthor = ''
    let poemBody = ''
    let poemLines = ''
    const poemLinesPath = 'http://poetrydb.org/title/' + poemTitle.replace(/\s+/, '+')
    http.get(poemLinesPath, (res) => {
      let poemData = ''
      res.on('data', (d) => { poemData += d })
      res.on('end', () => {
        const poemObj = JSON.parse(poemData)
        if (poemObj.length > 0) {
          poemTitle = poemObj[0].title
          poemAuthor = poemObj[0].author
          poemBody = poemObj[0].lines.join()
          poemLines = poemObj[0].linecount.toString()
        } else {
          poemError = true
        }
        const speechOutputData = {
          poemError: poemError,
          poemTitle: poemTitle,
          poemAuthor: poemAuthor,
          poemLines: poemLines,
          poemBody: poemBody
        }
        resolve(speechOutputData)
      })
      res.on('error', (error) => {
        reject(error)
      })
    })
  })
}

module.exports = {
  poetryDesk: poetryDesk,
  getRandomPoemByPoet: getRandomPoemByPoet
}
