String.prototype.hashCode = function() {
    var hash = 0;
    for (var i = 0; i < this.length; i++) {
        var char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return this[0] + hash;
}

d3.json('data/episodes.json').then(data => { // loading episodes
    const episodes = _.values(data);
    d3.json('data/casting.json').then(data => { // loading casting

        // ###########################################################
        // ######## DATA CLEANING AND PROCESSING ##################### 
        // ########################################################### 

        const casting = _.values(data);
        // sorting casting
        casting.sort((a,b) => d3.descending(a.Keyword.length, b.Keyword.length)); 
        // group synopsis
        const epSynopsis = episodes.reduce((acc, current) => acc + current.Synopsis, "");
        // breaks down sentences into actions
        const epActionsBreakDown = epSynopsis.match( /[^\.!\?]+[\.!\?]+/g ).map(s => s.trim()); // breaking down the synopsis into sentences.
        // calculates characters appearances
        const epAppearances = 
            epActionsBreakDown.map(action => {
            let who = [];
            let actionDescription = action;
            casting.forEach(character => {
                if (actionDescription.includes(character.Keyword)) {
                actionDescription = actionDescription.replaceAll(character.Keyword, ''); // removes the name from the action description
                who.push(character.Keyword);
                }
            });
            who.sort((a,b) => d3.ascending(action.indexOf(a), action.indexOf(b)));
            return who;
        });  
        // discovers characters appearance order in the whole plot
        const appearanceOrder = [];
        epAppearances.forEach(action => {
            action.forEach(ap => {
            if (!appearanceOrder.includes(ap)) {
                appearanceOrder.push(ap);
            }
            });
        }); 
        // calculates the characters score 
        const charScoreTrack = [];
        let liveScore = { 'action' : 0 };
        casting.forEach(c => {
            liveScore[c.Keyword] = 0;
        });
//        charScoreTrack.push(_.cloneDeep(liveScore));
        epAppearances.forEach(charsInAction => {
            liveScore.action++;
            casting.forEach(c => {
            if (charsInAction.includes(c.Keyword)) {
                liveScore[c.Keyword]+=0.25; // if the characters appears in an action, it gets +1
            } else {
                liveScore[c.Keyword]-=0.1; // if the characters doesn't appear in an action, its score is faded
                if (liveScore[c.Keyword] < 0) {
                liveScore[c.Keyword] = 0;
                }
            }
            });
            charScoreTrack.push(_.cloneDeep(liveScore)); 
        });

        // ###########################################################
        // ## DATA IS GOOD!!! NOW LET'S PREPARE THE VISUALIZATION ####
        // ########################################################### 

        const xAxysSize = document.querySelector('#stream').offsetWidth*30;
        const yAxysSize = document.querySelector('#stream').offsetWidth*.7;
        const color = d3.scaleOrdinal(casting.map((c, i) => d3.interpolateYlGnBu(1/casting.length*i))).domain(casting.map(c => c.Keyword));
    

        const stack = d3.stack()
            .offset(d3.stackOffsetWiggle)
            .keys(appearanceOrder);
        const series = stack(charScoreTrack);

        const x = d3.scaleLinear()
            .domain([2, epAppearances.length-1])
            .range([0, xAxysSize]);
        
        const y = d3.scaleLinear()
            .domain([0,d3.max(series[series.length-1], d => d[1])])
            .range([0, yAxysSize]);            

        const area = d3.area()
            .x(function(d) { return x(d.data.action); })
            .y0(function(d) { return y(d[0]); })
            .y1(function(d) { return y(d[1]); }).curve(d3.curveBasisOpen);

        console.log(area);

        const svg = d3.select('#stream')
            .append('svg')
            .attr('width', document.querySelector('#stream').offsetWidth)
            .attr('height', xAxysSize);

        const chart = svg
            .append('g')
            //.attr('transform', 'scale(1,-1) translate(0,-' + yAxysSize + ')');
            .attr('transform', 'translate(' + document.querySelector('#stream').offsetWidth/1.5 + ',0) rotate(90)');

        const streams = chart
            .selectAll('path')
            .data(series)
            .join('path')
            .attr('d', area)
            .attr('fill', d => color(d.key))
            .attr('original-color', d => color(d.key))
            .attr('id', d => 'stream-' + d.key.hashCode())
            .attr('class', 'stream');

        const legends = chart
            .selectAll('text')
            .data(casting)
            .join('text')
            .append('textPath')
            .attr('xlink:href', d => '#stream-' + d.Keyword.hashCode()).text(d => d.Name)
            .attr('startOffset', 10)
            .style('opacity', 0);  

        const cards = d3.select('#characters-cards')
            .selectAll('div')
            .data(casting)
            .join('div')
            .attr('class', 'card')
            .attr('id', d => 'card-' + d.Keyword.hashCode());

        cards.append('img')
            .attr('src', d => 'assets/img/casting/' + d.Avatar + '.png');          

        cards.append('h3')
            .text(d => d.Name);

        // ###########################################################
        // ## ADDING INTERACTIVITY ###################################
        // ########################################################### 

        streams
        .on('click', (e,d) => {
          if (d3.selectAll('#info-overlay').nodes().length == 0) {
            const s = d3.select('#stream-' + d.key.hashCode());
            const myColor = d3.color(s.attr('fill'));
            chart.append('rect')
              .attr('fill', '#FFE9D9')
              .attr('width', 100000)
              .attr('height', 100000)
              .attr('transform', 'translate(0,-50000)')
              .attr('opacity', '0')
              .attr('id', 'info-overlay')
              .transition().duration('500').attr('opacity', '0.95');
            s.raise();
            s.attr('fill', myColor.darker(2));
            const c = d3.select('#card-' + d.key.hashCode());
            c.style('display', 'block');
            c.select('img').style('border-color', myColor.darker(2));
            const cards = d3.select('#characters-cards');
            cards.style('display', 'block');
            cards.attr('curr', d.key);
            d3.select('#cards-control').style('display', 'flex');
          }
        })
        .on('mouseover', function(d, i) {
          d3.select(this).transition()
            .duration('50')
            .attr('opacity', '.75')
            .style('cursor', 'pointer');
        })
        .on('mouseout', function(d, i) {
          d3.select(this).transition()
            .duration('50')
            .attr('opacity', '1')
        });        

        d3.select('#close-card')
            .on('click', function() { 
                d3.select('#info-overlay').transition().duration('500').attr('opacity', '0').remove();
                d3.selectAll('.card').style('display', 'none');
                const cards = d3.select('#characters-cards');
                cards.style('display', 'none');
                cards.attr('curr', null);
                d3.selectAll('path.stream').attr('fill', s => color(s.key)).lower();
                d3.select('#cards-control').style('display', 'none');
        });

        d3.select('#prev-card')
            .on('click', function() {
                const cards = d3.select('#characters-cards');
                const currChar = cards.attr('curr');
                d3.selectAll('.card').style('display', 'none');
                d3.selectAll('path.stream').attr('fill', s => color(s.key));
                const oldS = d3.select('#stream-' + currChar.hashCode());
                oldS.lower();
                const currCharIndex = appearanceOrder.indexOf(currChar);
                let prevChar;
                if (currCharIndex == appearanceOrder.length-1) {
                    prevChar = appearanceOrder[0];
                } else {
                    prevChar = appearanceOrder[currCharIndex+1];
                }
                const s = d3.select('#stream-' + prevChar.hashCode());
                const myColor = d3.color(s.attr('fill'));
                s.raise();
                s.attr('fill', myColor.darker(2));
                const c = d3.select('#card-' + prevChar.hashCode());
                c.style('display', 'block');
                c.select('img').style('border-color', myColor.darker(2));                             
                cards.attr('curr', prevChar);
            });

            d3.select('#next-card')
            .on('click', function() {
                const cards = d3.select('#characters-cards');
                const currChar = cards.attr('curr');
                d3.selectAll('.card').style('display', 'none');
                d3.selectAll('path.stream').attr('fill', s => color(s.key));
                const oldS = d3.select('#stream-' + currChar.hashCode());
                oldS.lower();
                const currCharIndex = appearanceOrder.indexOf(currChar);
                let otherChar;
                if (currCharIndex == 0) {
                    otherChar = appearanceOrder[appearanceOrder.length-1];
                } else {
                    otherChar = appearanceOrder[currCharIndex-1];
                }
                const s = d3.select('#stream-' + otherChar.hashCode());
                const myColor = d3.color(s.attr('fill'));
                s.raise();
                s.attr('fill', myColor.darker(2));
                const c = d3.select('#card-' + otherChar.hashCode());
                c.style('display', 'block');
                c.select('img').style('border-color', myColor.darker(2));                             
                cards.attr('curr', otherChar);
            });   
            
            window.addEventListener('scroll', function() {
                currScore = charScoreTrack[Math.ceil(getScrollPercent()*0.95*charScoreTrack.length)+1];
                legends.transition().duration('1000').attr('startOffset', function(l) {
                    let streamPath = document.getElementById('stream-' + l.Keyword.hashCode())
                    if (streamPath !== null) {
                        const l = (streamPath.getTotalLength()*0.5)-document.documentElement.clientHeight;
                        return l*getScrollPercent()+100;
                    }
                    return 0;
                }).style('opacity', d => (currScore[d.Keyword] == 0 ? 0 : 1));
            })

    });
});


function getScrollPercent() {
    var h = document.documentElement, 
        b = document.body,
        st = 'scrollTop',
        sh = 'scrollHeight';
    return (h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight);
}





