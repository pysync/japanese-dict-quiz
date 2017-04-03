'use strict';
const _ = require('lodash');
const fs = require('fs');
const prompt = require('syncprompt');
const colors = require('colors');
const Table = require('cli-table');
const util  = require('util');
const moji = require('moji');
const syncrequest = require('sync-request');
var request = require('request');
var progress = require('request-progress');
const decompress = require('decompress');

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
    SS_FN: __dirname + '/.session.json',
    QUIZ_DIR: __dirname + '/assets/quiz',
    EMO_FN: __dirname + '/assets/config/emotion.json',
    JVD_FN: __dirname + '/assets/dict/japanese_vietnamese.json',
    KJD_FN: __dirname + '/assets/dict/kanji.json',
    LIMIT: 5,
    DOWNLOAD_DES: __dirname + '/assets',
    FETCH_DATA_PATH: 'http://dungntnew.github.io/assets',
    FETCH_DATA_DIRS: ['dict', 'quiz'],
    GG_URL: 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=bd&dj=1&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=at&sl=%s&tl=%s&q=%s',
}

class DataFetcher extends Object {
    constructor() {
        super();
    }

    needFetchDirs() {
        const dirs = [];
        Config.FETCH_DATA_DIRS.forEach(d => {
            if (!fs.existsSync(Config.DOWNLOAD_DES + '/' + d)){
                dirs.push(d);
            }
        });
        return dirs;
    };

    startFetch(dirs, onUpdate, onComplete) {
        const downloaders = _.map(dirs, (dir => {
            const downloadUrl = Config.FETCH_DATA_PATH + '/' + dir + '.zip';
            const savePath = Config.DOWNLOAD_DES + '/' + dir + '.zip';
            
            return new Promise((resove, reject)=> {

                progress(request(downloadUrl), {
                    throttle: 10, 
                })
                .on('progress', function (state) {
                    onUpdate(state);
                })
                .on('error', function (err) {
                    reject(err)
                })
                .on('end', function () {
                    decompress(savePath, Config.DOWNLOAD_DES).then(files => {
                        resove(files);
                    });
                })
                .pipe(fs.createWriteStream(savePath));
            });
        }));

        Promise.all(downloaders).then((files) => {
            if (onComplete) {
                onComplete();
            }
        });
     }

}

class Dict extends Object {

    constructor() {
        super();
    
        this.wdb = JSON.parse(fs.readFileSync(Config.JVD_FN, 'utf8'));
        this.kdb = JSON.parse(fs.readFileSync(Config.KJD_FN, 'utf8'));
    }

    isKanji(str) {
        return /^[\u4e00-\u9faf]+$/.test(str);
    }
    
    isJapanese(str) {
        return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(str);
    }

    format(content) {
        if (_.isEmpty(content)) return '';
        
        if (!_.includes(content, '◆')) {
            return content;
        }
        return content.split('◆').join('\n\n◆')
                      .split('※').join('\n\n※')
                      .split(':').join('\n')
    }

    summary(content) {
        if (_.isEmpty(content)) return '';
        
        if (!_.includes(content, '◆')) {
            return content;
        }

        const lines = content.split('◆')
        const phontic = _.trim(lines[0].replace('∴「', '').replace(/」.*/, ''));
        
        const means = []
        for (let i = 1; i < lines.length - 1; i++) {
            const parts = lines[i].split('※');
            if (parts.length > 1) {
                means.push(_.trim(parts[0]));
            }
        }
        return {
            phontic: phontic,
            means: means
        }
    }

    searchWord(word) {
        let results = _.uniqBy(_.filter(this.wdb, (w) => {
            return w.word === word;
        }), r => r.content);
 
        results = _.slice(results, 0, Config.LIMIT);

       let others = []
        if (results.length < Config.LIMIT) {
            let others = _.unionBy(_.filter(this.wdb, (w) => {
                return w.word !== word 
                       &&
                       _.startsWith(w.word, word); 
            }), r => r.content);
            others = _.slice(others, 0, Config.LIMIT - results.length);
        }

        return {
            found: results.length > 0,
            matches: _.map(results, r => ({
                id: r.id,
                word: r.word,
                summary: this.summary(r.content),
                content: this.format(r.content),
                kanjiInfo: this.briefKanji(word + r.word),
            })),
            others: _.map(others, r => ({
                id: r.id,
                word: r.word,
                kanjiInfo: this.briefKanji(word + r.word),
                summary: this.summary(r.content),
                content: this.format(r.content),
            })),
        }
    }

    searchKanji(kanji) {
        let results = _.filter(this.kdb, (k) => {
            return k.Word === kanji || _.toUpper(k.Mean) === _.toUpper(kanji)
        });

        return {
            found: results.length > 0,
            matches: results,
        }
    }

    briefKanji(text) {
    　　const kanjis = _.uniq(_.filter(text.split(''), (w) => {
                return this.isKanji(w)
        }));

        return _.map(kanjis, k => {
            const r = this.searchKanji(k);
            if (!r.found) {
                return `${k}-<empty>`
            }
            else {
                const d = r.matches[0];
                return `${k}-${d.Mean}`
            }
        }).join(' | ');
    }

    trans(text, sl, tl) {
        let reply     = {};
        const q         = encodeURIComponent(text);
        if (!sl) {
            sl = this.isJapanese(text) ? 'ja': 'vi';
            tl = sl === 'ja' ? 'vi': 'ja';
        }
        const url       = util.format(Config.GG_URL, sl, tl, q);
        
        const res = syncrequest('GET', url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36',
                'Content-Type': 'application/json; charset=utf-8',
                'accept-language': 'en-US,en;q=0.8,en-GB;q=0.6,vi;q=0.4,ja;q=0.2,zh-CN;q=0.2,zh;q=0.2',
                'authority': 'translate.googleapis.com'
            }
        })
        
        const raw = res.getBody('utf8');
        const ret = JSON.parse(raw);
        if (ret) {
            ret.kanjiInfo =  this.briefKanji(raw);
        }

        return ret;
    }
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
        this.out(`${k}`.input + `${v}`.white);
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
    clear() {
        this.out('\x1Bc');
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

    downloading(s) {
        const {time, size, percent} = s;
        const {elapsed, remaining} = time;
        const {total, transferred} = size;
        const progress = `elapsed=${elapsed} seconds,  ${Math.floor(percent * 100)}% [${transferred}bytes/${total}bytes]`;
        this.i('fetching: ' + progress);
    }

    input(pmt = '> '.underline.red, options={}) {
        let s = _.trim(prompt(pmt, options));
        s = moji(s).convert('ZE', 'HE').toString();
        s = moji(s).convert('ZS', 'HS').toString();
        return s;
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

    wait(msg='press any key to view more..[q for break]') {
        this.i(msg)
        return this.input() !== 'q';
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

    table(head) {
        return new Table({
            chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
                    , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
                    , 'left': '' , 'left-mid': '-' , 'mid': '-' , 'mid-mid': '-'
                    , 'right': '' , 'right-mid': '-' , 'middle': ' ' },
            style: { 'padding-left': 0, 'padding-right': 0 },
            head: head,
        });
    }

    searchWordResults(word, result) {
        
        const table = this.table(['辞書検索', word])
        const lines = [];

        lines.push({'Found': result.found ? 'Yes[' + result.matches.length+']': 'No'});
        
        const each = (w) => {
            let explain = (w.content || '-').replace(/##/g, '\n');
            explain = this.splitter(explain, 80).join('\n');
            
            lines.push({'Word': w.word || '-'})
            lines.push({'Phontic': w.summary.phontic ||'-'})
            lines.push({'Kanji Info': this.limiter(w.kanjiInfo)});
            lines.push({'Brief': w.summary.means.join(',') ||'-'})
            lines.push({'Explain': explain})
        }

        _.each(result.matches, each); 

        if (result.others.length > 0){
            lines.push({'その他': result.others.length})
            _.each(result.others, each); 
        }

        table.push(...lines);
        this._();
        console.info(table.toString());
        this._();
    };

    splitter(str, l) {
        var strs = [];
        while(str.length > l){
            var pos = str.substring(0, l).lastIndexOf(' ');
            pos = pos <= 0 ? l : pos;
            strs.push(str.substring(0, pos));
            var i = str.indexOf(' ', pos)+1;
            if(i < pos || i > pos+l)
                i = pos;
            str = str.substring(i);
        }
        strs.push(str);
        return strs;
    }

    limiter(str, l=80) {
        return this.splitter(str, l).join('\n');
    };


    searchKanjiResults(kanji, result) {
        const head = this.table(['漢字検索', kanji])
        head.push({'FOUND': result.found ? 'YES[' + result.matches.length+']': 'NO'});
        this._();
        console.info(head.toString());

        for(let index=0; index< result.matches.length; index++) {
            
            const k = result.matches[index];
            const components =_.map(k.ComponentDetails, c => {
                return `${c.w || '-'}: ${c.h || '-'}`
            }).join(' | ')

            const examples = _.map(k.Examples, (e) => {
                return {w: `${e.w}`, m: `${e.h} ${e.p} ${e.m}`};
            });

            let explain = (k.GiaiNghia || '-').replace(/##/g, '\n');
            explain = this.limiter(explain);
            
            const body = this.table(['結果', `${index} / ${result.matches.length}`]);
            const lines = [];
            
            lines.push({'Kanji': `${k.Word} 「 JLPT ${k.Level || '-'} 」` || '-'})
            lines.push({'Freq': k.Freq ||'-'})
            lines.push({'Stroke': k.StrokeCount ||'-'})
            lines.push({'Mean': `${k.Mean} 「 ${components} 」`})
            lines.push({'Onyomi': k.Onyomi ||'-'})
            lines.push({'Kunyomi': k.Kunyomi ||'-'})
            lines.push({'Explain': explain ||'-'})
            
            if (examples.length > 0) {
                lines.push({'Examples': examples.length })
            }
            _.each(examples, ({w, m}, i) => {
                lines.push({[w]: m});
            });
            body.push(...lines);
            console.info(body.toString());

            if (result.matches.length > 1 && index < result.matches.length - 1) {
                if (!this.wait('press any key to view more..')) {
                    break;
                }
            };

            this._();
        }
         this._();
    }

    kanjiQuickView(kanji, result) {
        const table = this.table(['漢字検索', kanji])
        const lines = []
        lines.push({'FOUND': result.found ? 'YES[' + result.matches.length+']': 'NO'});
        
        lines.push({'結果一覧': this.limiter(_.map(result.matches, k => k.Word).join(','), 40)});

         const each = (k, index) => {
            const components =_.map(k.ComponentDetails, c => {
                return `${c.w || '-'}: ${c.h || '-'}`
            }).join(' | ')
            lines.push({'Kanji': `${k.Word} 「 JLPT ${k.Level || '-'} 」` || '-'})
            lines.push({'Mean': `${k.Mean} 「 ${components} 」`})
            lines.push({'Onyomi': k.Onyomi ||'-'})
            lines.push({'Kunyomi': k.Kunyomi ||'-'})
        }
        _.each(result.matches, each); 
        this._();
        table.push(...lines);
        console.info(table.toString());
    }

    transResult(word, result) {
       
        const table = this.table(['翻訳', word])
        const lines = []
        
        if (!result) {
            lines.push({'Trans': '<Empty>'})
            lines.push({'Translit': '<Empty>'});
        }          

        const {sentences} = result;
        
        const trans = _.filter(_.map(sentences, s => s.trans), (s) => {
            return _.isString(s) && s.length > 0 
        });

        const translit = _.find(_.map(sentences, s => {
            return result.src === 'vi' 
                        ? s.translit
                        : s.src_translit;
        }), (s) => {
            return _.isString(s) && s.length > 0 
        });

        _.each(trans, (t) => {
            lines.push({ 'Trans': this.limiter(t || '-')});
        })
        
        lines.push({'Translit': this.limiter(translit || '-')});
        lines.push({'Kanji Info': this.limiter(result.kanjiInfo)});
        table.push(...lines);
        this._();
        console.info(table.toString()); 
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
        if (playing.key === info.key && playing.curr < playing.total) {
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
        this.fetcher = new DataFetcher();
        
        this.ui = new UI();

        this.handlers = {
            clear: this.clear.bind(this),
            menu: this.quizMenu.bind(this),
            quiz: this.quizMenu.bind(this),
            top: this.quizMenu.bind(this),
            home: this.quizMenu.bind(this),
            m: this.quizMenu.bind(this),

            dict: this.search.bind(this),
            d: this.search.bind(this),
            t: this.trans.bind(this),
            
            kanji: this.kanji.bind(this),
            quick: this.quick.bind(this),
            info: this.kanji.bind(this),
            k: this.kanji.bind(this),
            
            quit: this.quit.bind(this),
            exit: this.quit.bind(this),
            q: this.quit.bind(this),
            
            help: this.help.bind(this),
            h: this.help.bind(this),
            _: this.smart.bind(this),
        }

        this.lastInput = '';
    };

    clear() {
        this.ui.clear();
    }

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
            const args = _.slice(strs, 1).join(' '); 

            const handler = handlers[cmd];
            
            let complete 
            
            if (handler) {
                this.lastInput = args;
                complete = handler(args);
            }
            
            else if (handlers._) {
                this.lastInput = raw;
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
        this.checkData(()=> {
            this.initData();
            this.tryRestore();
            this.loop(this.handlers);
        });
    }

    initData() {
        this.dict = new Dict();
    }

    checkData(onComplete) {
        const dirs = this.fetcher.needFetchDirs();
        if (dirs.length > 0) {
            const msg = `You need download ${dirs.join(',')} for first time usage`;
            const ok = this.ui.yn(`${msg}\nYes to continue?[y/N]?`);
            if (ok) {
                this.fetcher.startFetch(dirs, (s)=> {
                    this.ui.downloading(s)
                }, ()=> {
                    onComplete();
                });
            }
            else {
                this.quit();
            }
        }
        else {
            onComplete();
        }
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

    smart(input) {
        if (input && _.isString(input)) {
            if (input.length > 4) {
                this.trans(input);
            }
            else if (input.length == 1) {
                this.kanji(input);
            }
            else {
                this.search(input);
            }
        }
    }

    search(word) {
        if (_.isEmpty(_.trim(word))) {
            return;
        }
        const r = this.dict.searchWord(word);
        this.ui.searchWordResults(word, r);
    }

    trans(word) {
        const r = this.dict.trans(word);
        this.ui.transResult(word, r);
    }

    kanji(word) {
        if (_.isEmpty(_.trim(word))) {
            return;
        }

        const kanjis = this.dict.isKanji(word) ? word.split(''): [word];
        for(let i = 0; i < kanjis.length; i++) {
            const k = kanjis[i];
            const r = this.dict.searchKanji(k);
            this.ui.searchKanjiResults(k, r);

            if (kanjis.length > 1 && i < kanjis.length - 1)  {
                if (!this.ui.wait()) {
                    break;
                }
            }
        }
    }

    quick(word) {
        word = this.infer(word);
        const kanjis = this.dict.isKanji(word) ? word.split(''): [word];
        for(let i = 0; i < kanjis.length; i++) {
            const k = kanjis[i];
            const r = this.dict.searchKanji(k);
            this.ui.kanjiQuickView(k, r);

            if (kanjis.length > 1 && i < kanjis.length - 1)  {
                if (!this.ui.wait()) {
                    break;
                }
            }
        }
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
               if (this.quest) {
                   this.ui.quizR(this.quest, playing.curr, playing.total);
               } 
           },
           t: (input) => {
               if (this.quest) {
                   this.trans(this.quest.question);
               }
           },

           v: (input) => {
               if (this.quest) {
                   const {question} = this.quest
                   const {answer} = this.quest

                   if (this.dict.isKanji(question)) {
                       this.smart(question);
                   }
                   else {
                       const answers = answer.split('※');
                       _.each(answers, (a) => {
                           this.search(a);
                       });
                   }
               } 
           },

           k: (input) => {
               if (this.quest) {
                   const {question} = this.quest
                   const {answer} = this.quest

                   const text = (question + answer).replace('※', '');
                　　const kanjis = _.uniq(_.filter(text.split(''), (w) => {
                        return this.dict.isKanji(w)
                    }));
                    if (kanjis.length > 0) {
                        this.kanji(kanjis.join(''));
                    }
                    else {
                        this.ui.red('No Kanji.');
                    }
               }  
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
                const a = q.answer.split('※');
                const k = _.parseInt(input);
                const c = _.parseInt(q.correct);
                
                if (k === c || input === a[c]) {
                    this.ui.quizR(q, playing.curr, playing.total);
                    this.ui.sugoi(playing.curr, playing.total);
                    playing.curr += 1;
                    
                }
                else {
                    this.ui.zannen(playing.curr, playing.total);
                }
            }
        });

        const quest = () => {
            this.quest = lession.data[playing.curr];
            return this.quest;
        }

        this.loop(handlers, ()=>  q || playing.curr >= playing.total, () => {
            this.ui.quizQ(quest(), playing.curr, playing.total);
        });
        
        this.session.saveGame(playing);
        this.ui.endQuiz(playing);
    }
};

new CLI().start();
