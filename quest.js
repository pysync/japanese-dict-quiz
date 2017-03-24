import program from 'commander';
import readline from 'readline';
import { readFile, readdir, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import _ from 'lodash';
const _pr = console.log

const dataSet = {
    kanjiList: [],
    kotoba: [],
}

const sessionFile = 'session.json';
const loadSession = () => {
    try {
        return JSON.parse(readFileSync(sessionFile, 'utf8'));
    }
    catch(e) {
        const defaultSession = {
            working: null
        }
        writeFileSync(sessionFile, JSON.stringify(defaultSession));
        return defaultSession
    }
}

const session = loadSession();

const saveSession = () => {
    writeFileSync(sessionFile, JSON.stringify(session));
};

const loadDataInDirs = (dirs, tag, onData) => {
    const wait = _.map(dirs, (dir, index) => 1);

    let dataList = []
    let fileCount = 0;

    const eachFile = (file, index, done) => {
        readFile(file, 'utf8', (err, data) => {
            if (err) {
                console.log('>>>', err)
            }
            else {
                const words = JSON.parse(data)
                _.each(words, (w) => {
                    dataList.push(w);
                })
            }
            if (done) done(index);
        });
    };

    _.each(dirs, (dir, dirIndex) => {
        wait[dirIndex] = 1
        readdir(dir, (err, files) => {
            if (err) {
                wait[dirIndex] = 0;
                console.log('>>>', err)
            }
            else {
                wait[dirIndex] = files.length;
                fileCount += files.length;
                _.each(files, (file, fileIndex) => {
                    eachFile(`${dir}/${file}`, fileIndex, () => {
                        wait[dirIndex] -= 1
                        if (_.sum(wait) === 0) {
                            //_pr(`=======LOADED ${dataList.length} ${tag}/${fileCount}  FILES ====`);
                            if (onData) onData(dataList);
                        }
                    });
                });
            }
        });
    });
};

const readQuest = (fileName, onQuest) => {
    // _pr(`========PROCESSING: ${fileName} ==========`);
    return readFile(fileName, 'utf8', (err, data) => {
        if (err) {
            console.log(">>>", err);
        }
        else {
            if (onQuest) {
                onQuest(JSON.parse(data));
            }
        }
    });
}


const eachQuest = (rl, count, total, quest, repeat, onAnswer) => {

    printQuest(count, total, quest);
    let questLabel = `${repeat ? '[R]' : ''}もっとよいものをせんたくしなさい`
    questLabel += '\n(h for hint word, k for hint kanji, b for go menu, q for quit)'
    questLabel += '\n: '
    rl.question(questLabel, (answer) => {
        if (onAnswer) {
            onAnswer(answer);
        }
    });
}

const endQuest = (quit) => {
    _pr('End quest');
    saveSession();
    if (!quit) {
        setTimeout(() => {
            _pr('')
            _pr('')
            showLessions();
            _pr('')
        }, 1);
    }
    else {
        _pr('See you gain !');
    }
};

const printQuest = (count, total, quest) => {

    const question = quest.question
    const answers = quest.answer.split('※');
    _pr('');
    _pr(`Q[${count}/${total}]: ${quest.question}`);
    _.each(answers, (answer, index) => {
        _pr(`${index + 1} : ${answer}`);
    });
    _pr('');
};

const toMean = (word) => {
    const chars = word.split('')
    _.each(chars, (c, i) => {
        _pr(`${i}: ${c}`);
    });
    return '--'
};

const printKanji = (kanji) => {
    const { word,
        cn_mean,
        ucn_mean,
        vi_mean,
        uvi_mean,
        onjomi,
        r_onjomi,
        kunjomi,
        r_kunjomi,
        numstroke,
        note
        } = kanji;

    _pr(`${word} - ${cn_mean} => ${vi_mean}`)
    _pr(`STROKE: ${numstroke}`)
    _pr(`ON: ${onjomi} - ${r_onjomi}`)
    _pr(`KUN: ${kunjomi} - ${r_kunjomi}`)

    if (note) {
        _pr(`means:`)
        const lines = note.split('※')
        _.each(lines, (line) => {
            if (!_.isEmpty(line)) _pr(`※${line}`)
        });
        _pr(``)
    }
}

const searchKanji = (text) => {
    _pr(`Search: ${text} / total ${dataSet.kanjiList.length} kanji list`)
    const kanji = _.find(dataSet.kanjiList, {
        word: text
    })
    return kanji;
}

const printHintKanji = (quest) => {
    _pr('');
    _pr('Kanji Hints');
    const text = (quest.question + quest.answer).replace('※', '');
    _pr('TEXT: ' + text);
    const kanjis = _.filter(text.split(''), (w) => {
        return /^[\u4e00-\u9faf]+$/.test(w)
    });
    _pr('漢字一覧: ' + kanjis);

    const uniq = _.uniq(kanjis);
    if (uniq.length === 0) {
        _pr('No Kanji')
    }
    else {
        _.each(uniq, (c, i) => {
            const kanji = searchKanji(c);
            if (kanji) printKanji(kanji);
        });
    }
    _pr('');
};

const simpleKanjiFor = (word) => {
    const kanjis = _.filter(word.split(''), (w) => {
        return /^[\u4e00-\u9faf]+$/.test(w)
    });
    return _.map(kanjis, (k) => {
        const kanji = searchKanji(k)
        if (!kanji) return '<NF>'
        return '<' + kanji.cn_mean + ' ' + kanji.onjomi + ' ' + kanji.vi_mean + '>'
    }).join(' | ')
};

const printHint = (quest) => {
    const answers = quest.answer.split('※');
    const correct = parseInt(quest.correct);
    const questionKanji = simpleKanjiFor(quest.question);

    _pr('');
    _pr('WORD HINT');
    _pr(`Q: ${quest.question}`)
    if (questionKanji) {
        _pr(`(${questionKanji})`)
    }

    _pr(`正しい：${correct + 1}`)
    _.each(answers, (answer, index) => {
        const kanji = simpleKanjiFor(answer);
        const kanjiMean = kanji ? `[${kaji}]` : '';
        if (index === correct) {
            _pr(`🌟 ： ${answer} ${kanjiMean}`);
        }
        else {
            _pr(`${index + 1} ： ${answer} ${kanjiMean}`);
        }
    });
    _pr('');
};

const goodJobs = [
    '素晴らしい！❤️',
    'すごい！💓',
    '日本人ですか！(◎_◎;)',
    '神！！！！🎶',
    '完璧Σ（・□・；）',
    '正解🙆',
]

const badJobs = [
    '残念！️😞',
    '違います',
    'No No No',
]

const showEmotion = (correct) => {

    if (correct) {
        const rand = _.random(0, goodJobs.length - 1);
        _pr(`---------${goodJobs[rand]}  ----------`);
        _pr(`---------NEXT=> ----------`);
    }
    else {
        const rand = _.random(0, badJobs.length - 1);
        _pr(`---------${badJobs[rand]}  ----------`);
        _pr('---------もいっかい！がんばれ！p(^_^)----------');
    }
}

const handleAnswer = (quest, answer, next) => {
    let correct = false;
    let hint = false;
    const answers = quest.answer.split('※');

    if (answer === 'h' || answer === 'help' || answer === 'hint') {
        printHint(quest);
        hint = true;
    }
    else if (answer === 'k' || answer === 'kanji') {
        printHintKanji(quest);
        hint = true;
    }
    else if (answer === 'b' || answer === 'back') {
        if (next) next(false, true);
    }
    else if (answer === 'q' || answer === 'quit') {
        if (next) next(false, false, true);
    }
    else if (answer === 'r' || answer === 'reset') {
        if (next) next(false, false, false, true);
    }
    else {
        const correctIndex = parseInt(quest.correct);
        const correctText = answers[correctIndex];

        if (`${answer}` === `${correctIndex + 1}`
            || `${answer}` === correctText) {
            correct = true;
        }
        else {

            correct = false;
        }
        showEmotion(correct);
    }

    setTimeout(() => {
        if (next) next(correct);
    }, 300);
}


const showQuestsInfo = (quests) => {
    _pr('Quest total: ', quests.length);
};

const beginQuest = (quests, lession) => {
    showQuestsInfo(quests);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let wait = false;
    let count = parseInt(lession.questId) || 0;
    const total = quests.length;
    let repeat = false;

    const updatSession = () => {
        session.working = Object.assign({}, lession, {
            questId: count,
            questTotal: total,
        })
    }

    let interval = setInterval(() => {

        if (count >= total) {
            clearInterval(interval);
            rl.close();
            updatSession();
            endQuest();
            return;
        }
        if (wait) {
            return;
        }
        else {

            wait = true;

            let quest = quests[count];
            eachQuest(rl,
                count, total, quest,
                repeat,
                (answer) => {

                    handleAnswer(quest, answer, (correct, back, quit, reset) => {
                        if (back || quit) {
                            clearInterval(interval);
                            rl.close();
                            updatSession();
                            endQuest(quit);
                            return;
                        }
                        if (reset) {
                            count = 0;
                            wait = false;
                            repeat = false;
                            return;
                        }

                        repeat = !correct;
                        if (correct) {
                            count += 1;
                        }
                        wait = false;
                    });

                });
        }

    }, 100);

}


const showLessions = () => {

    const data = {
        topics: []
    }

    const topics = readdirSync('quest');
    _.each(topics, (topic, topicIndex) => {

        const topicData = {
            id: topicIndex,
            name: topic,
            lessions: []
        }


        const lessions = readdirSync(`quest/${topic}`);
        _.each(lessions, (lession, lessionId) => {
            const name = lession.split('.')[0].split('_');

            topicData.lessions.push({
                id: lessionId,
                key: `${topic}_${lessionId}`,
                name: name[name.length - 1],
                topic: topic,
                topicId: topicIndex,
                lessionId: lessionId,
                path: `quest/${topic}/${lession}`
            })
        });

        data.topics.push(topicData);
    });

    _pr('')
    _pr('')
    _pr('All Lessions');
    _pr('')

    _.each(data.topics, (t) => {
        _pr(`[${t.id}]${t.name} [0 -> ${t.lessions.length}]`)
    });
    _pr('')

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const please = () => {
        rl.question('選択(例えば：0_15)： ', (answer) => {
            if (answer === 'q' || answer === 'quit') {
                rl.close();
                _pr('See you again!');
                return;
            };

            if (!answer || answer.split('_').length !== 2) {
                _pr('>>> 授業ID正しくありません')

                please();
                return;
            }
            const topicId = answer.split('_')[0]
            const lessionId = answer.split('_')[1]
            const topic = data.topics[topicId]
            if (!topic || !topic.lessions[lessionId]) {
                _pr('>>> 授業ID正しくありません')

                please();
                return;
            }
            const lession = topic.lessions[lessionId];
            rl.close();
            _pr('選択した授業は: ' + lession.key);
            readQuest(lession.path, (quests) => {
                beginQuest(quests, lession);
            })

        });
    }
    please();
}

const preLoadData = (done) => {
    const tasks = [
        {
            dirs: ['n2kj'],
            tag: 'kanji',
            key: 'kanjiList',
            title: '2K漢字辞書'
        },
        // {
        //     dirs: ['quest/kanji_n2'],
        //     tag: 'kanji_n2',
        //     key: 'qkjn2',
        //     title: '漢字N２テスト'
        // },
        // {
        //     dirs: ['quest/kanji_n3'],
        //     tag: 'kanji_n3',
        //     key: 'qkjn3',
        //     title: '漢字N３テスト'
        // },
        // {
        //     dirs: ['quest/grammar_n3'],
        //     tag: 'grammar_n3',
        //     key: 'qgn3',
        //     title: '文法N3テスト'
        // },
        // {
        //     dirs: ['quest/grammar_n2'],
        //     tag: 'grammar_n2',
        //     key: 'qgn2',
        //     title: '文法N２テスト'
        // },
        // {
        //     dirs: ['quest/kotoba_n3'],
        //     tag: 'kotoba_n3',
        //     key: 'qktn3',
        //     title: '語彙N3テスト'
        // },
        // {
        //     dirs: ['quest/kotoba_n2'],
        //     tag: 'kotoba_n2',
        //     key: 'qktn2',
        //     title: '語彙N２テスト'
        // },
    ];

    let wait = tasks.length;
    _.each(tasks, (task, index) => {
        loadDataInDirs(task.dirs, task.tag, (data) => {
            dataSet[task.key] = data;
            wait -= 1
            if (wait === 0) {
                if (done) done();
            }
        });
    });
};

const tryLoadLastSession = () => {
    if (session && session.working && session.working.key) {
        const lession = session.working;
        _pr('最後の学習授業は: ' + lession.key + ` (${lession.questId}/${lession.questTotal})` ) ;

        readQuest(lession.path, (quests) => {
            beginQuest(quests, lession);
        })
        return true;
    }
    else {
        return false;
    }
}

preLoadData(() => {
    if (!tryLoadLastSession()) {
        showLessions();
    }
})
