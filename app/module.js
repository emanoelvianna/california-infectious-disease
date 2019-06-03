angular.module('app', [
    'resource',
    'ngMaterial'
    ]).config(function ($mdThemingProvider) {
        $mdThemingProvider.theme('default')
            .primaryPalette('grey')
            .accentPalette('blue');
    });