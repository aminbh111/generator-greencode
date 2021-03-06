'use strict';
var util = require('util'),
    generators = require('yeoman-generator'),
    chalk = require('chalk'),
    scriptBase = require('../generator-base'),
    cleanup = require('../cleanup'),
    packagejs = require('../../package.json'),
    exec = require('child_process').exec;

var GreencodeGenerator = generators.Base.extend({});

util.inherits(GreencodeGenerator, scriptBase);

/* Constants use throughout */
const constants = require('../generator-constants');

var currentQuestion = 0;
var totalQuestions = constants.QUESTIONS;
var configOptions = {};

module.exports = GreencodeGenerator.extend({
    constructor: function () {
        generators.Base.apply(this, arguments);
        // This adds support for a `--skip-client` flag
        this.option('skip-client', {
            desc: 'Skip the client-side application generation',
            type: Boolean,
            defaults: false
        });

        // This adds support for a `--skip-server` flag
        this.option('skip-server', {
            desc: 'Skip the server-side application generation',
            type: Boolean,
            defaults: false
        });

        // This adds support for a `--skip-user-management` flag
        this.option('skip-user-management', {
            desc: 'Skip the user management module during app generation',
            type: Boolean,
            defaults: false
        });

        // This adds support for a `--[no-]i18n` flag
        this.option('i18n', {
            desc: 'Disable or enable i18n when skipping client side generation, has no effect otherwise',
            type: Boolean,
            defaults: true
        });

        // This adds support for a `--with-entities` flag
        this.option('with-entities', {
            desc: 'Regenerate the existing entities if any',
            type: Boolean,
            defaults: false
        });

        // This adds support for a `--[no-]check-install` flag
        this.option('check-install', {
            desc: 'Check the installation',
            type: Boolean,
            defaults: true
        });

        this.skipClient = configOptions.skipClient = this.options['skip-client'] || this.config.get('skipClient');
        this.skipServer = configOptions.skipServer = this.options['skip-server'] || this.config.get('skipServer');
        this.skipUserManagement = configOptions.skipUserManagement = this.options['skip-user-management'] || this.config.get('skipUserManagement');
        this.withEntities = this.options['with-entities'];
        this.checkInstall = this.options['check-install'];

    },
    initializing: {
        displayLogo: function () {
            this.printGreencodeLogo();
        },

        checkJava: function () {
            if (!this.checkInstall || this.skipServer) return;
            var done = this.async();
            exec('java -version', function (err, stdout, stderr) {
                if (err) {
                    this.log(chalk.yellow.bold('WARNING!') + ' Java 8 is not found on your computer.');
                } else {
                    var javaVersion = stderr.match(/(?:java|openjdk) version "(.*)"/)[1];
                    if (!javaVersion.match(/1\.8/)) {
                        this.log(chalk.yellow.bold('WARNING!') + ' Java 8 is not found on your computeur. Your Java version is: ' + chalk.yellow(javaVersion));
                    }
                }
                done();
            }.bind(this));
        },

        checkGit: function () {
            if (!this.checkInstall || this.skipClient) return;
            var done = this.async();
            exec('git --version', function (err) {
                if (err) {
                    this.log(chalk.yellow.bold('WARNING!') + ' git is not found on your computer.\n',
                        ' Install git: ' + chalk.yellow('http://git-scm.com/')
                    );
                } else {
                    this.gitInstalled = true;
                }
                done();
            }.bind(this));
        },

        checkGitConnection: function () {
            if (!this.gitInstalled) return;
            var done = this.async();
            exec('git ls-remote git://github.com/greencode/generator-greencode.git HEAD', {timeout: 15000}, function (error) {
                if (error) {
                    this.log(chalk.yellow.bold('WARNING!') + ' Failed to connect to "git://github.com"\n',
                        ' 1. Check your Internet connection.\n',
                        ' 2. If you are using an HTTP proxy, try this command: ' + chalk.yellow('git config --global url."https://".insteadOf git://')
                    );
                }
                done();
            }.bind(this));
        },

        checkBower: function () {
            if (!this.checkInstall || this.skipClient) return;
            var done = this.async();
            exec('bower --version', function (err) {
                if (err) {
                    this.log(chalk.yellow.bold('WARNING!') + ' bower is not found on your computer.\n',
                        ' Install bower using npm command: ' + chalk.yellow('npm install -g bower')
                    );
                }
                done();
            }.bind(this));
        },

        checkGulp: function () {
            if (!this.checkInstall || this.skipClient) return;
            var done = this.async();
            exec('gulp --version', function (err) {
                if (err) {
                    this.log(chalk.yellow.bold('WARNING!') + ' gulp is not found on your computer.\n',
                        ' Install gulp using npm command: ' + chalk.yellow('npm install -g gulp-cli')
                    );
                }
                done();
            }.bind(this));
        },

        validate: function () {
            if (this.skipServer && this.skipClient) {
                this.env.error(chalk.red('You can not pass both ' + chalk.yellow('--skip-client') + ' and ' + chalk.yellow('--skip-server') + ' together'));
            }
        },

        setupVars: function () {
            this.applicationType = this.config.get('applicationType');
            if (!this.applicationType) {
                this.applicationType = 'monolith';
            }
            this.baseName = this.config.get('baseName');
            this.greencodeVersion = this.config.get('greencodeVersion');
            this.testFrameworks = this.config.get('testFrameworks');
            this.enableTranslation = this.config.get('enableTranslation');
            this.nativeLanguage = this.config.get('nativeLanguage');
            this.languages = this.config.get('languages');
            var configFound = this.baseName != null && this.applicationType != null;
            if (configFound) {
                this.existingProject = true;
            }
        }
    },

    prompting: {
        askForInsightOptIn: function () {
            if (this.existingProject) return;

            var done = this.async();
            var insight = this.insight();
            this.prompt({
                when: function () {
                    return insight.optOut === undefined;
                },
                type: 'confirm',
                name: 'insight',
                message: 'May ' + chalk.cyan('Greencode') + ' anonymously report usage statistics to improve the tool over time?',
                default: true
            }, function (prompt) {
                if (prompt.insight !== undefined) {
                    insight.optOut = !prompt.insight;
                }
                done();
            }.bind(this));
        },

        askForApplicationType: function () {
            if (this.existingProject) return;

            var done = this.async();
            var getNumberedQuestion = this.getNumberedQuestion;

            this.prompt({
                type: 'list',
                name: 'applicationType',
                message: function (response) {
                    return getNumberedQuestion('Which *type* of application would you like to create?', currentQuestion, totalQuestions, function (current) {
                        currentQuestion = current;
                    }, true);
                },
                choices: [
                    {
                        value: 'monolith',
                        name: 'Monolithic application (recommended for simple projects)'
                    },
                    {
                        value: 'microservice',
                        name: 'Microservice application'
                    },
                    {
                        value: 'gateway',
                        name: 'Microservice gateway'
                    }
                ],
                default: 'monolith'
            }, function (prompt) {
                this.applicationType = configOptions.applicationType = prompt.applicationType;
                done();
            }.bind(this));
        },

        askForModuleName: function () {
            if (this.existingProject) return;

            this.askModuleName(this, currentQuestion++, totalQuestions);
            configOptions.lastQuestion = currentQuestion;
            configOptions.totalQuestions = totalQuestions;
        }
    },

    configuring: {
        setup: function () {
            configOptions.skipI18nQuestion = true;
            configOptions.baseName = this.baseName;
            configOptions.logo = false;
            this.generatorType = 'app';
            if (this.applicationType == 'microservice') {
                this.skipClient = true;
                this.generatorType = 'server';
                this.skipUserManagement = configOptions.skipUserManagement = true;
            }
            if (this.skipClient) {
                // defaults to use when skipping client
                this.generatorType = 'server';
                configOptions.enableTranslation = this.options['i18n'];
            }
            if (this.skipServer) {
                this.generatorType = 'client';
                // defaults to use when skipping server
            }
        },

        composeServer: function () {
            if (this.skipServer) return;

            this.composeWith('greencode:server', {
                options: {
                    'client-hook': !this.skipClient,
                    configOptions: configOptions
                }
            }, {
                local: require.resolve('../server')
            });
        },

        composeClient: function () {
            if (this.skipClient) return;

            this.composeWith('greencode:client', {
                options: {
                    'skip-install': this.options['skip-install'],
                    configOptions: configOptions
                }
            }, {
                local: require.resolve('../client')
            });

        },

        askFori18n: function () {
            currentQuestion = configOptions.lastQuestion;
            totalQuestions = configOptions.totalQuestions;
            if (this.skipI18n || this.existingProject) return;
            this.aski18n(this, currentQuestion++, totalQuestions);
        }
    },

    default: {

        askForTestOpts: function () {
            if (this.existingProject) return;

            var getNumberedQuestion = this.getNumberedQuestion;
            var choices = [];
            if (!this.skipServer) {
                // all server side test frameworks should be addded here
                choices.push(
                    {name: 'Gatling', value: 'gatling'},
                    {name: 'Cucumber', value: 'cucumber'}
                );
            }
            if (!this.skipClient) {
                // all client side test frameworks should be addded here
                choices.push(
                    {name: 'Protractor', value: 'protractor'}
                );
            }
            var done = this.async();

            this.prompt({
                type: 'checkbox',
                name: 'testFrameworks',
                message: function (response) {
                    return getNumberedQuestion('Which testing frameworks would you like to use?', currentQuestion, totalQuestions, function (current) {
                        currentQuestion = current;
                    }, true);
                },
                choices: choices,
                default: ['gatling']
            }, function (prompt) {
                this.testFrameworks = prompt.testFrameworks;
                done();
            }.bind(this));
        },

        setSharedConfigOptions: function () {
            configOptions.lastQuestion = currentQuestion;
            configOptions.totalQuestions = totalQuestions;
            configOptions.testFrameworks = this.testFrameworks;
            configOptions.enableTranslation = this.enableTranslation;
            configOptions.nativeLanguage = this.nativeLanguage;
            configOptions.languages = this.languages;
        },

        insight: function () {
            var insight = this.insight();
            insight.track('generator', 'app');
            insight.track('app/applicationType', this.applicationType);
            insight.track('app/testFrameworks', this.testFrameworks);
        },

        composeLanguages: function () {
            if (this.skipI18n) return;
            this.composeLanguagesSub(this, configOptions, this.generatorType);
        },

        saveConfig: function () {
            this.config.set('greencodeVersion', packagejs.version);
            this.config.set('applicationType', this.applicationType);
            this.config.set('baseName', this.baseName);
            this.config.set('testFrameworks', this.testFrameworks);
            this.skipClient && this.config.set('skipClient', true);
            this.skipServer && this.config.set('skipServer', true);
            this.skipUserManagement && this.config.set('skipUserManagement', true);
            this.config.set('enableTranslation', this.enableTranslation);
            if (this.enableTranslation) {
                this.config.set('nativeLanguage', this.nativeLanguage);
                this.config.set('languages', this.languages);
            }
        }
    },

    writing: {

        cleanup: function () {
            cleanup.cleanupOldFiles(this, this.javaDir, this.testDir);
        },

        regenerateEntities: function () {
            if (this.withEntities) {
                this.getExistingEntities().forEach(function (entity) {
                    this.composeWith('greencode:entity', {
                        options: {
                            regenerate: true,
                            'skip-install': true,
                        },
                        args: [entity.name]
                    }, {
                        local: require.resolve('../entity')
                    });
                }, this);
            }
        }
    },

    end: {
        afterRunHook: function () {
            try {
                var modules = this.getModuleHooks();
                if (modules.length > 0) {
                    this.log('\n' + chalk.bold.green('Running post run module hooks\n'));
                    // run through all post app creation module hooks
                    modules.forEach(function (module) {
                        if (module.hookFor == 'app' && module.hookType == 'post') {
                            // compose with the modules callback generator
                            try {
                                this.composeWith(module.generatorCallback, {
                                    options: {
                                        appConfig: configOptions
                                    }
                                });
                            } catch (err) {
                                this.log(chalk.red('Could not compose module ') + chalk.bold.yellow(module.npmPackageName) +
                                    chalk.red('. \nMake sure you have installed the module with ') + chalk.bold.yellow('\'npm -g ' + module.npmPackageName + '\''));
                            }
                        }
                    }, this);
                }
            } catch (err) {
                this.log('\n' + chalk.bold.red('Running post run module hooks failed. No modification done to the generated app.'));
            }
        }
    }
});
