const {buffer, text, json} = require('micro')
const {send} = require('micro')
const sleep = require('then-sleep')
 
module.exports = async (req, res) => {
    await sleep(500)
    const buf = await buffer(req)

    console.log(buf)

    //const txt = await text(req)

    //const js = await json(req)

    //console.log(js.price)
    const data = {error: 'One Error Ready'}

    send(res, 400, data)
}

