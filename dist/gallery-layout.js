/* Dimension-driven masonry: reserved image ratios avoid lazy-load shifts.
   Editorial focal IDs live in photos.js; position never determines identity. */
(function(root) {
  function archiveLayout(photos,width,columns,mobile) {
    const gap = mobile ? 22 : 36, rowGap = mobile ? 32 : 48;
    const unit = (width-gap*(columns-1))/columns;
    const bottoms = Array(columns).fill(0), items = [];
    photos.forEach(p => {
      const span = p.featured ? Math.min(2,columns) : 1;
      let col = 0;
      if (span > 1 && columns > 2) {
        col = p.featureSide === 'right' ? columns-span : p.featureSide === 'center' ? 1 : 0;
      } else {
        let best = Infinity;
        for(let c=0;c<=columns-span;c++) {
          const y = Math.max(...bottoms.slice(c,c+span));
          if(y < best) {best=y;col=c;}
        }
      }
      const top = Math.max(...bottoms.slice(col,col+span));
      const cardWidth = unit*span+gap*(span-1);
      const height = (cardWidth-(mobile?14:20))*p.height/p.width+(mobile?50:67);
      items.push({left:col*(unit+gap),top,width:cardWidth,height});
      for(let c=col;c<col+span;c++) bottoms[c]=top+height+rowGap;
    });
    return {items,height:items.length?Math.max(...bottoms)-rowGap:0};
  }
  root.archiveLayout=archiveLayout;
  if(typeof module !== 'undefined') module.exports=archiveLayout;
})(typeof window !== 'undefined'?window:globalThis);
