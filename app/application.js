(function () {
  'use strict';
  angular
    .module('app')
    .controller('AppCtrl', Controller);

  Controller.$inject = [
    '$q',
    '$scope',
    'resource.LoadingScreenService'
  ];

  function Controller($q, $scope, LoadingScreenService) {
    const COLORS = {
      INFECTED: '#ff6f69',
      FREE: '#88d8b0',
      UNDEFINED: '#cecece',
      SUSCEPTIBLE: '#ffcc5c'
    };
    var map;
    var bar;
    var _deferred = $q.defer();
    /* public variables */
    var self = this;
    self.diseases = [];
    self.diseaseSelected = undefined;
    self.yearSelected = undefined;

    self.infectiousDiseaseData;
    self.distributionBySex;
    self.barSize;

    /* Lifecycle hooks */
    self.$onInit = onInit;
    self.filter = filter;

    function onInit() {
      LoadingScreenService.start();
      d3.csv('data/infectious-disease-data.csv').then(function (data) {
        self.infectiousDiseaseData = data;
        _buildDistributionInMap();
        _setDiseaseList();
        filter('2005');
        _buildDistributionChartAboutSex();
        LoadingScreenService.finish();
      });
    }

    function _setDiseaseList() {
      self.infectiousDiseaseData.map(function (d) {
        if (!self.diseases.includes(d.Disease))
          self.diseases.push(d.Disease);
      });
      self.diseaseSelected = self.diseases[0];
      $scope.$apply();
    }

    function _buildDistributionInMap() {
      var width = 450;
      var height = 550;

      var projection = d3.geoMercator()
        .scale(1000 * 2)
        .center([-120, 37])
        .translate([width / 2, height / 2]);

      var path = d3.geoPath()
        .projection(projection);

      map = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height);

      d3.json('data/california-map.json').then(function (ca) {
        map.append('path')
          .datum(topojson.feature(ca, ca.objects.subunits))
          .attr('class', 'land')
          .attr('d', path);

        /* bind feature data to the map */
        map.selectAll('.subunit')
          .data(topojson.feature(ca, ca.objects.subunits).features)
          .enter()
          .append('path')
          .attr('class', function (d) {
            return 'subunit ' + d.properties.name;
          })
          .attr('d', path)
          .on('mouseover', function (d) { //tooltip
            div.transition()
              .duration(200)
              .style('opacity', .9);
            div.html(d.properties.fullName)
              .style('left', (d3.event.pageX - 350) + 'px')
              .style('top', (d3.event.pageY - 30) + 'px');
          })
          .on('mouseout', function (d) {
            div.transition()
              .duration(500)
              .style('opacity', 0.0);
          });

        /* exterior border */
        map.append('path')
          .datum(topojson.mesh(ca, ca.objects.subunits, function (a, b) { return a === b; }))
          .attr('d', path)
          .attr('class', 'exterior-boundary');

        /* tooltop declaration */
        var div = d3.select('#map').append('div')
          .attr('class', 'tooltip')
          .style('opacity', 0);

        /* legend to the map */
        // TODO:
      });
    }

    function _buildDistributionChartAboutSex() {
      d3.select('#sex-distribution').selectAll('*').remove();

      var margin = { top: 10, right: 5, bottom: 30, left: 50 };
      var width = 300;
      var height = 100;

      var bar = d3.select('#sex-distribution')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      var x = d3.scaleLinear()
        .domain([0, self.barSize]) // TODO:
        .range([0, width]);
      bar.append('g')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'translate(-10,0)rotate(-45)')
        .style('text-anchor', 'end');

      // Y axis
      var y = d3.scaleBand()
        .range([0, height])
        .domain(self.distributionBySex.map(function (d) { return d.sex; }))
        .padding(.1);
      bar.append('g')
        .call(d3.axisLeft(y))

      //Bars
      bar.selectAll('myRect')
        .data(self.distributionBySex)
        .enter()
        .append('rect')
        .attr('x', x(0))
        .attr('y', function (d) { return y(d.sex); })
        .attr('width', function (d) { return x(d.value); })
        .attr('height', y.bandwidth())
        .attr('fill', '#69b3a2')
    }

    function filter(yearSelected) {
      var filteredDiseases = self.infectiousDiseaseData.filter(function (data) {
        if (_condition(self.diseaseSelected, yearSelected, data))
          return data;
      });

      _distributionFilterBySex(filteredDiseases);

      map.selectAll('.subunit')
        .style('fill', function (d) {
          for (var i = 0; i < filteredDiseases.length; i++) {
            if (filteredDiseases[i].County === d.properties.name) {
              if (filteredDiseases[i]['CI.upper'] < '0.898') {
                return '#cecece';
              } else if (filteredDiseases[i]['CI.upper'] < '2.801') {
                return '#ffcc5c'
              } else if (filteredDiseases[i]['CI.upper'] < '5.801') {
                return '#ff6f69';
              } else {
                return '#2db7e2';
              }
            }
          }
        });
    }

    function _distributionFilterBySex(filteredDiseases) {
      self.distributionBySex = [
        { sex: 'Male', value: 0 },
        { sex: 'Female', value: 0 }
      ];
      for (var i = 0; i < filteredDiseases.length; i++) {
        if (filteredDiseases[i].Sex === 'Male') {
          self.distributionBySex[0].value += Number(filteredDiseases[i].Count);
        } else if (filteredDiseases[i].Sex === 'Female') {
          self.distributionBySex[1].value += Number(filteredDiseases[i].Count);
        }
      }
      self.barSize = self.distributionBySex[0].value > self.distributionBySex[1].value ? self.distributionBySex[0].value : self.distributionBySex[1].value
      _buildDistributionChartAboutSex();
    }

    function _condition(diseaseSelected, yearSelected, data) {
      return diseaseSelected === data.Disease && data.Year === yearSelected;
    }
  }
}());