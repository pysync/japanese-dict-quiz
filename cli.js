
const _ = require('lodash');
const fs = require('fs');
const prompt = require('syncprompt');
const colors = require('colors');
const _pr = console.log;
const debug = console.debug;

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  cancel: 'yellow',
});

const Config = {
    SS_FN: __dirname + '/session_.json',
    QUIZ_DIR: __dirname + '/quest',
    EMO_FN: __dirname + '/emotion.json',
}

class QuizProvider extends Object {

    static get(info) {
        const data = JSON.parse(fs.readFileSync(info.path, 'utf8'));
        
        return {
            info: _.merge({}, info, {
                total: data.length,
            }),
            data,
        }
    };

    static getByKey(lessionKey) {
        const topicId = _.parseInt(lessionKey.split('_')[0])
        const lessionId = parseInt(lessionKey.split('_')[1])

        const quizInfo = QuizProvider.getQuizInfo();
        return quizInfo[topicId].lessions[lessionId];
    } 

    static getQuizInfo() {

        if (QuizProvider.quizInfo) {
            return QuizProvider.quizInfo;
        }

        const tdir = fs.readdirSync(Config.QUIZ_DIR);

        QuizProvider.quizInfo = _.map(tdir, (tname, topicId) => {
            
            const ldir = fs.readdirSync(`${Config.QUIZ_DIR}/${tname}`);

            return {
                id: topicId,
                topicId: topicId,
                name: tname,
                lessions: _.map(ldir, (lname, lessionId) => {
                    return {
                        id: lessionId,
                        lessionid: lessionId,
                        name: lname.split('.')[0],
                        hash: `${tname}_${lessionId}`,
                        key: `${topicId}_${lessionId}`,
                        topicId: topicId,
                        path: `${Config.QUIZ_DIR}/${tname}/${lname}`,
                    }
                }),
            }
        });
        return QuizProvider.quizInfo;
    }
}

class UI extends Object {
    constructor() {
        super()

        this.out = console.log;
        this.emotions = JSON.parse(fs.readFileSync(Config.EMO_FN, 'utf8'));
    }
    _(num=1){
        _.times(num, ()=> this.out());
    }
    i(str) {
        this.out(str.input);
    }
    q(str) {
        this.out(str.blue);
    }
    a(str) {
        this.out(str.underline.red);
    }
    qav(k, v) {
        this.out(`${k}`.input + `${v}`.blue);
    }
    akv(k, v) {
        this.out(`${k}`.input + `${v}`.red);
    }
    sakv(k, v) {
        this.out((`${k}`.input + `${v}`.green).underline);
    }
    error(str) {
        this.out(str.error);
    }
    warn(str) {
        this.out(str.warn);
    }

    info(str) {
        this.out(str.info);
    }
    debug(str) {
        this.out(str.debug);
    }
    verbose(str) {
        this.out(str.verbose);
    }
    help(str) {
        this.out(str.help);
    }
    msg(str) {
        this.out(str);
    }
    red(str) {
        this.out(str.red)
    }
    redline(str) {
        this.out(str.underline.red)
    }
    green(str) {
        this.out(str.green)
    }
    greenline(str) {
        this.out(str.underline.green)
    }
    blue(str) {
        this.out(str.blue)
    }
    silly(str) {
        this.out(str.silly)
    }
    good(str) {
        this.out(str.silly);
    }
    bad(str) {
        this.out(str.red);
    }

    cancelled() {
        this.msg('Cancelled!'.cancel);
    }
    bye() {
        this.msg('Bye bye!');
    }
    serving() {
        this._();
        this.silly('typing anything to request');
    }

    input(pmt = '> '.underline.red, options={}) {
        return _.trim(prompt(pmt, options));
    }

    yn(msg) {
        this._();
        let input
        do {
            this.i(msg);
            input = this.input();
            
        } while(!_.includes(['y', 'Y', 'n', 'N'], input));
        
        return _.includes(['y', 'Y'], input);
    }

    selectKey(options, msg, verbose=false) {
        this._();
        const func = () => {

            if (verbose) {
                _.each(options, (item, index) => {
                    this.i(`[${index}]${item}`);
                });
                this.i(msg);
            }
            else {
                const limit = `[0...${options.length}]`.underline
                this.i(`${msg} ${limit}`);
            }
            
            const raw = this.input();
            return {choice: _.parseInt(raw, 10), raw} 
        };

        let ret
        let cancelled = false
        do {
             ret = func();
             cancelled = ret.raw === 'q' || ret.raw === 'quit' || ret.raw === 'exit';
        }
        while(!cancelled && (_.isNaN(ret.choice) || (ret.choice < 0 || ret.choice >= options.length)))

        return {choice: ret.choice, cancelled};
    }

    quizQ(quest, num, total) {
        this._();
        const options = quest.answer.split('※');

        this.qav(`Q[${num}/${total}]:`, `${quest.question}`);
        _.each(options, (item, index) => {
            this.akv(`[${index}] `, item);
        });
    }

    quizR(quest, num, total) {
        this._();
        const options = quest.answer.split('※');
        const correct = _.parseInt(quest.correct, 10);

        this.qav(`Q[${num}/${total}]:`, `${quest.question}`);
        _.each(options, (item, index) => {
            if (index === correct) {
                this.sakv(`[${index}] `, item);
            }
            else {
                this.akv(`[${index}] `, item);
            }
        });
    }

    endQuiz(playing) {
        this._();
        this.silly(`${playing.name} clear!`);
    }

    sugoi(num, total) {
        this._();
        const rand = _.random(0, this.emotions.goods.length - 1);
        const emo = this.emotions.goods[rand];
        
        if (num < total) {
            this.good(`${emo}　次へ`)
        }
        else {
            this.good(emo);
        }
    }

    zannen(num, total) {
        this._();
        const rand = _.random(0, this.emotions.bads.length - 1);
        const emo = this.emotions.bads[rand];
        this.bad(`${emo} もう一回`);
    }
}

class Session extends Object {
    constructor() {
        super()
        this.load(); 
    }

    save() {
        const str = JSON.stringify(this.data);
        fs.writeFileSync(Config.SS_FN, str, 'utf8');
    }

    load() {
        try {
            const str = fs.readFileSync(Config.SS_FN, 'utf8');
            this.data = JSON.parse(str);
        }
        catch(e) {
            this.data = {
                playing: {}, // playing lesssion,
                meta: {
                    viewed: [],
                    completed: [],
                    score: 0,
                    correct: 0,
                    incorect: 0,
                    accuracy: 0.0,
                },
            }
            this.save();
        }
        return this.data;
    }

    getData() {
        return this.data;
    }

    newQuiz(lession) {
        const {data} = this;
        const {playing} = data || {}
        const {meta} = data
        
        const {info} = lession;
        let newPlaying
        if (playing.key === info.key) {
             newPlaying = _.merge({}, info, playing);
        }
        else {
            newPlaying = _.merge({}, info, {
                curr: 0,
                correct: 0,
                incorect: 0,
            })
        };

        this.data = _.merge({}, data, {
            playing: newPlaying,
            meta: _.merge(meta, {
                viewed: _.uniq([...meta.viewed, info.key])
            }),

        });
        return newPlaying;
    }

    saveGame(playing) {
        const {data} = this
        const {meta} = data
        this.data = _.merge({}, data, {
            playing: playing,
            meta: _.merge(meta, {
                completed: playing.curr >= playing.total 
                          ?  _.uniq([...meta.completed, playing.key]):
                          [...meta.completed],
            }),
        });
        this.save();
    }
}

class CLI extends Object {
    constructor() {
        super();
        
        this.name = 'CLI';
        this.session = new Session();
        this.ui = new UI();

        this.handlers = {
            menu: this.quizMenu.bind(this),
            quiz: this.quizMenu.bind(this),
            top: this.quizMenu.bind(this),
            home: this.quizMenu.bind(this),
            m: this.quizMenu.bind(this),

            dict: this.dict.bind(this),
            d: this.dict.bind(this),
            t: this.dict.bind(this),
            
            kanji: this.kanji.bind(this),
            look: this.kanji.bind(this),
            info: this.kanji.bind(this),
            k: this.kanji.bind(this),
            
            quit: this.quit.bind(this),
            exit: this.quit.bind(this),
            
            help: this.help.bind(this),
            h: this.help.bind(this),
            _: this.help.bind(this),
        }
    };

    help(handlers) {
        const keys = _.keys(handlers || this.handlers).filter(k => k.length > 1);
        this.ui.blue('usage: [' + keys + ']');
    }

    loop(handlers, completeIf, before) {
        const run = ()=> {
            
            if (before) before();
            
            const raw = this.ui.input();
            const strs = raw.split(' ');
            const cmd = strs[0];
            const args = _.slice(strs, 1); 

            const handler = handlers[cmd];
            
            let complete 
            
            if (handler) {
                complete = handler(...args);
            }
            
            else if (handlers._) {
                complete = handlers._(raw);
            }
            
            else {
                this.ui.msg('Unknown cmd: ' + raw);
                complete = this.help(handlers);
            }
            
            return completeIf ? (complete || completeIf()): complete;
        };

        while(!run()) {}
    }

    start() {
        this.tryRestore();
        this.loop(this.handlers);
    }

    tryRestore() {
        const {data} = this.session;
        const {playing} = data;
       
        if (playing && 
            playing.path && 
            playing.curr < playing.total) {
                const msg = `You are playing lession ${playing.name}, at: ${playing.curr}/${playing.total}`;
                const ok = this.ui.yn(`${msg}\nAre you want to continue?[y/N]?`);
                if (ok) {
                    const lessionInfo = QuizProvider.getByKey(playing.key);
                    return this.gameStart(lessionInfo) 
                }
                else {
                    this.ui.serving();
                }
        }
        else {
            this.ui.serving();
        }
    }

    quit() {
        this.session.save();
        this.ui.bye();
        return true;
    }

    quizMenu() {
        const quizInfo = QuizProvider.getQuizInfo();
        const topics = _.map(quizInfo, (topic) => topic.name);
        let topicSelect = this.ui.selectKey(topics, 'Which Topic?', true);
        
        if (topicSelect.cancelled) {
            this.ui.cancelled();
            return;
        }
        
        const topic = quizInfo[topicSelect.choice]
        const lessions = _.map(topic.lessions, (lession)=> lession.name);
        const lessionSelect = this.ui.selectKey(lessions, 'Which Lession?');

        if (lessionSelect.cancelled === -1) {
            this.ui.cancelled();
            return;
        }
        
        const lessionInfo = topic.lessions[lessionSelect.choice];
        return this.gameStart(lessionInfo)
    }

    dict(word) {
        this.ui.msg('translate for: ' + word);
    }

    kanji(kanji) {
        this.ui.msg('lookup for kanji: ' + kanji);
    }

    gameStart(lessionInfo) {

        const lession = QuizProvider.get(lessionInfo);
        const playing = this.session.newQuiz(lession);
        
        let q = false;
        const handlers = _.merge({}, this.handlers, {
           
           // handle quit Quiz.
           quit: () => {
               q = true;
               this.session.saveGame(playing);
           },
           
           // handle help
           h: (input) => {

           },

           // handle next q
           n: (input ) => {
               playing.curr += 1;
               if (playing.curr >= playing.total) {
                   playing.curr = playing.total;
               }
           },

           // handle back
           b: (input) => {
               playing.curr -= 1;
               if (playing.curr < 0) {
                   playing.curr = 0;
               }
           },

           // handle question & answers
            _: (input) => {
                
                const q = quest();
                const k = _.parseInt(input);
                const c = _.parseInt(q.correct);
                
                if (k === c) {
                    this.ui.quizR(q, playing.curr, playing.total);
                    this.ui.sugoi(playing.curr, playing.total);
                    playing.curr += 1;
                    
                }
                else {
                    this.ui.zannen(playing.curr, playing.total);
                }
            }
        });

        const quest = () => lession.data[playing.curr];

        this.loop(handlers, ()=>  q || playing.curr >= playing.total, () => {
            this.ui.quizQ(quest(), playing.curr, playing.total);
        });
        
        this.session.saveGame(playing);
        this.ui.endQuiz(playing);
    }
};

new CLI().start();