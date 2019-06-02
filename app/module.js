angular.module('app', ['ngMaterial'])
    .config(function ($mdThemingProvider) {
        $mdThemingProvider.theme('default')
        .primaryPalette('grey')
        .accentPalette('blue');
    });