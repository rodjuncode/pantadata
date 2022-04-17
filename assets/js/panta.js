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
                liveScore[c.Keyword]-=0.5; // if the characters doesn't appear in an action, its score is faded
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
            .attr('fill', d => d3.interpolateGnBu(Math.random()))
            .attr('id', d => 'stream-' + d.key.hashCode());

        const cards = d3.select('#characters-cards')
            .selectAll('div')
            .data(casting)
            .join('div')
            .attr('class', 'card')
            .attr('id', d => 'card-' + d.Keyword.hashCode())
            .append('h3')
            .text(d => d.Name)
            .append('img')
            .attr('src', d => 'assets/img/casting/' + d.Avatar + '.png')
            .attr('width', 200)
            .attr('height', 200);


        // ###########################################################
        // ## ADDING INTERACTIVITY ###################################
        // ########################################################### 

        streams
        .on('click', (e,d) => {
          d3.select('#overlay')
            .transition().duration('500').style('opacity', '0.9');
          if (d3.selectAll('#info-overlay').nodes().length == 0) {
            chart.append('rect')
              .attr('fill', '#FFE9D9')
              .attr('width', 100000)
              .attr('height', 100000)
              .attr('transform', 'translate(0,-50000)')
              .attr('opacity', '0')
              .attr('id', 'info-overlay')
              .transition().duration('500').attr('opacity', '0.9');
            d3.select('#stream-' + d.key.hashCode()).raise();
            d3.select('#card-' + d.key.hashCode()).style('display', 'flex');
            d3.select('#characters-cards').style('display', 'block');
          }
        })
        .on('mouseover', function(d, i) {
          d3.select(this).transition()
            .duration('50')
            .attr('opacity', '.75') 
        })
        .on('mouseout', function(d, i) {
          d3.select(this).transition()
            .duration('50')
            .attr('opacity', '1')
        });        

        d3.select('#close-card')
            .on('click', function() { 
                d3.select('#info-overlay').transition().duration('500').attr('opacity', '0').remove();
                d3.select('#overlay')
                .transition().duration('500').style('opacity', '0');
                d3.selectAll('.card').style('display', 'none');
                d3.select('#characters-cards').style('display', 'none');
        });

    });
});


