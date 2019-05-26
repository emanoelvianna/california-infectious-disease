const COLORS = {
    INFECTED: '#ff6f69',
    FREE: '#88d8b0',
    UNDEFINED: '#cecece',
    SUSCEPTIBLE: '#ffcc5c'
};

buildMap('Amebiasis', '2005'); // TODO:

function buildMap(disease, year) {
    var width = 650,
        height = 600;

    var projection = d3.geoMercator()
        .scale(1000 * 2)
        .center([-120, 36])
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    var svg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height);

    d3.json('data/california-map.json', function (error, ca) {
        d3.csv('data/infectious-disease-data.csv', function (error, data) {

            var filtered = data.filter(function (d) {
                if (disease === d.Disease && d.Year === year && d.Sex === "Total")
                    return d;
            });

            console.log(filtered);

            svg.append('path')
                .datum(topojson.feature(ca, ca.objects.subunits))
                .attr('class', 'land')
                .attr('d', path);

            /* bind feature data to the map */
            svg.selectAll('.subunit')
                .data(topojson.feature(ca, ca.objects.subunits).features)
                .enter()
                .append('path')
                .attr('class', function (d) {
                    return 'subunit ' + d.properties.name;
                })
                .style(".subunit", function (d) {
                    var color;
                    var result = filtered.find(function (data) {
                        if (data.Count > 5) {
                            color = COLORS.FREE;
                            console.log('opa1');
                        } else {
                            color = COLORS.INFECTED;
                            console.log('opa2');
                        }
                    });
                    return color;
                })
                .attr('d', path)
                .on('mouseover', function (d) { //tooltip
                    div.transition()
                        .duration(200)
                        .style('opacity', .9);
                    div.html(d.properties.fullName)
                        .style('left', (d3.event.pageX) + 10 + 'px')
                        .style('top', (d3.event.pageY - 30) + 'px');
                })
                .on('mouseout', function (d) {
                    div.transition()
                        .duration(500)
                        .style('opacity', 0.0);
                });

            /* exterior border */
            svg.append('path')
                .datum(topojson.mesh(ca, ca.objects.subunits, function (a, b) { return a === b; }))
                .attr('d', path)
                .attr('class', 'exterior-boundary');

            /* tooltop declaration */
            var div = d3.select('#map').append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0);

            /* legend to the map */
            // TODO:

            /* slider to the years */
            // TODO:
        });
    });
}