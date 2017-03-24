import _ from 'lodash';
const _pr = console.log


const kanjis = _.filter('※不敬∴ふけい※不敬∴ふけい'.replace('※', '').split(''), (w)=>{
   return /^[\u4e00-\u9faf]+$/.test(w)
});

_pr(_.uniq(kanjis));
