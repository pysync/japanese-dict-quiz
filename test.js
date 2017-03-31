import _ from 'lodash';
import sqlite3 from 'sqlite3';

const _pr = console.log


const datapath    = __dirname + '/data/japanese_vietnamese.sqlite';
const jvdb    = new sqlite3.Database(datapath);
const jvtable = 'japanese_vietnamese';

const searchWord = (word, onResult, onError, onNotFound) => {
    const fields = _.map([['word', 'word'], 
                          ['content', 'content']], (field) => field.join(' as ')).join(', ');
    
    const query = `select ${fields} from ${jvtable} where word = '${word}' limit 10`;
    
    const wordProcess = (content) => {
        if (_.isEmpty(content)) return '';
        
        if (!_.includes(content, '◆')) {
            return content;
        }
        return content.split('◆').join('\n\n意味')
                      .split('※').join('\n\n例文：')
                      .split(':').join('\n翻訳：')
    }

    const summary = (content) => {
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

    jvdb.all(query, (err, results) => {
        if (err) {
            _pr('error: ', err);
            onError(err);
            return;
        }
        if (_.isEmpty(results)) {
            onNotFound();
        }
        else {
            const uniq = _.uniqBy(results, r => r.content);
            const out = _.map(uniq, ({id, word, content}) => {
                return {
                    id,
                    word,
                    summary: summary(content),
                    content: wordProcess(content)
                }
            });
            onResult(out);
        }
    })
}

searchWord('日本', results => {
    _.each(results, r => {
        _pr(r.word)
        _pr(r.summary)
        //_pr(r.content)
    })    
}
, _pr, _pr)

// const kanjis = _.filter('※不敬∴ふけい※不敬∴ふけい'.replace('※', '').split(''), (w)=>{
//    return /^[\u4e00-\u9faf]+$/.test(w)
// });

// _pr(_.uniq(kanjis));

