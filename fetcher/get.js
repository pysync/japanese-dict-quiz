import fetch from 'isomorphic-fetch'
import { writeFile } from 'fs'

const write = (name, data) => {
  console.log('writing: ', name);
  writeFile(name, data, (err) => {
    if (err) {
      return console.log('>>>', err);
    }
    console.log('wroten: ', name);
  });
}

const crawl = (url, topic, id, next) => {

  console.log("exec",topic, '-', id);

  fetch(url)
    .then(function (response) {
      return response.json()
    }).then(function (json) {

      write(topic + '_' + id + '.json', JSON.stringify(json));

      if (next) next();

    }).catch(function (ex) {
      console.log('>>> parsing failed', ex)
    })
}

const baseUrl = 'http://mina.mazii.net/api/getLessionJLPT.php?lessonid=';

const tasks = [{
  id: 11,
  name: 'kanji_n2'
},
{
  id: 8,
  name: 'kotoba_n2'
},
{
  id: 5,
  name: 'grammar_n2'
},
{
  id: 13,
  name: 'kanji_n3'
},
{
  id: 6,
  name: 'kotoba_n3'
},
{
  id: 3,
  name: 'grammar_n3'
},
];

const task = (config, done) => {

  const url = baseUrl + config.id;
  const name = config.name

  let count = 0;
  let watting = false;
  const loop = 100;

  let interval = setInterval(()=> {
    if (count >= loop) {
      clearInterval(interval);
      if (done) done();
      return;
    }
    else {
      if (!watting) {
        watting = true;
        crawl(url, name, count, ()=> {
          count += 1;
          watting = false;
        });
      }
    }
  }, 500);
}

const exec = (done) => {
  let index = 0;
  let watting = false;

  let interval = setInterval(()=> {
    if (index >= tasks.length) {
        clearInterval(interval);
        if (done) done();
      return;
    }
    else {
      if (!watting) {
        watting = true;
        task(tasks[index], ()=> {
          index += 1;
          watting = false;
        });
      }
    }
  }, 500);

}


exec();
