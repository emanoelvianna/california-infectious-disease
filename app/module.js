angular.module('app', [
    'resource',
    'ngMaterial'
]).config(function ($mdThemingProvider, $mdIconProvider) {
    $mdThemingProvider.theme('altTheme')
        .primaryPalette('grey', {
            'default': '900'
        }).accentPalette('grey', {
            'default': '700'
        }).dark();

    $mdThemingProvider.theme('default').dark();
    $mdThemingProvider.setDefaultTheme('altTheme');
    $mdThemingProvider.alwaysWatchTheme(true);
});