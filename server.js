var express = require('express');
var mustacheExpress = require('mustache-express');
var GitHubApi = require("github");
var NodeCache = require( "node-cache" );
var debug = require('debug')('api')
  , http = require('http')
  , name = 'My App';
var config = require('config');
var cache = new NodeCache({ stdTTL: 3600, checkperiod: 0 });

var github = new GitHubApi({
    // required
    version: "3.0.0",
    // optional
    debug: false,
    protocol: "https",
    host: "api.github.com",
    pathPrefix: "/",
    timeout: 5000,
    headers: {
        "user-agent": "My-Cool-GitHub-App" // GitHub is happy with a unique user agent
    }
});
github.authenticate(
    config.get('github.authenticate')
);

var organisation = config.get('github.organisation')

var repositoriesWhiteList = config.get('repositoryWhiteList');
var repositories = [];

cache.get('repositories', function( err, value ){
    if( !err ){
        if(value == undefined){
            // Fetch all repositories from org
            debug('organisation ' + organisation);
            github.repos.getFromOrg({
                'org': organisation,
                'per_page': 100
            }, function(err, githubRepositories){
                if(err){
                    debug('err ' + err);
                }
                githubRepositories.forEach(function(githubRepository){
                    if(-1 == repositoriesWhiteList.indexOf(githubRepository.name)){
                        return;
                    }

                    debug('githubRepository ' + githubRepository.name);
                    // Fetch PR
                    var pullRequests = [];
                    github.pullRequests.getAll({
                        user: organisation,
                        repo: githubRepository.name,
                        state: "open"
                    }, function(err, githubPullRequests) {
                        if(err){
                            debug('err ' + err);
                        }
                        githubPullRequests.forEach(function(githubPullRequest){
                            debug('githubPullRequest ' + githubPullRequest.number);
                            // Fetch labels
                            github.issues.getIssueLabels({
                                user: organisation,
                                repo: githubRepository.name,
                                number: githubPullRequest.number
                            }, function(err, githubLabels) {
                                if(err){
                                    debug('err ' + err);
                                }
                                githubPullRequest.labels = githubLabels;
                                debug('found ' + githubLabels.length + ' labels');
                                pullRequests.push(githubPullRequest);
                            });
                        });
                    });
                    githubRepository.pullRequests = pullRequests;
                    repositories.push(githubRepository);
                });
            });
            cache.set('repositories', repositories);
        }else{
            repositories = value;
        }
    }
});

var app = express();
app.listen(process.env.PORT || 3000);

// Register '.mustache' extension with The Mustache Express
app.engine('mustache', mustacheExpress());

app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');
 
app.get('/', function(req, res) {
    console.log(repositories);
    res.render('home', {repositories: repositories});
});
app.get('/flush', function(req, res) {
    cache.flushAll();
    debug('flushed');
});

app.use("/", express.static(__dirname + "/public/"));
