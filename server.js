var express = require("express");
var https = require("https");
var mongo = require('mongodb');

var app = express();
var myDBClient = mongo.MongoClient;
var myDBUrl = process.env.mongo_url;

app.param('searchKey', function(req, res, next, searchKey) {
    req.searchKey = searchKey;
    next();
});

app.get("/api/imagesearch/:searchKey",function(rq,rs){
   var ofst ="0";
  if(rq.param('offset'))
     ofst = rq.param('offset');
     getapi(rq.searchKey.replace(/ /g,"%20"),ofst,rs);
     
});
app.get("/api/latest/imagesearch/",function(rq,rs){
    retrieveFromDB(rs);
});


app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0");

function getapi(src,offSet,response){
    var options = {
        host: 'api.cognitive.microsoft.com',
        path: '/bing/v5.0/images/search?q='+src+'&count=10&offset='+offSet,
        headers: {"Ocp-Apim-Subscription-Key": process.env.subscription_key
        }
    };

    var req = https.request(options,function(res){
    var resdata ="";
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
        resdata += chunk;
    });
    res.on('end', function()  {
        var parsed = JSON.parse(resdata);
        var temp =[];
            if(!isEmpty(parsed)){
                if(parsed.hasOwnProperty('value')){
                    for(var i = 0;i<parsed.value.length;i++){
                        temp.push({url:parsed.value[i].contentUrl , snippet:parsed.value[i].name,
                        thumbnail:parsed.value[i].thumbnailUrl, context:parsed.value[i].hostPageUrl});
                    }
                }else if(parsed.hasOwnProperty('statusCode')){
                            console.log(parsed);
                }
            }
        writeDB(src);
        response.send(temp);
    });
    res.resume();
    }).on('error',function (e) {
        console.log(`problem with request: ${e.message}`);
    });
    req.end();
    }
function writeDB(search_key){
    var today = new Date();

        myDBClient.connect(myDBUrl, function(err, db) {
 	      if (err)
 	        console.log('Unable to connect to the mongoDB server. Error:', err);
 	      else {        
 	        var collection = db.collection('recentSearch');
 	            collection.insert({
 	                term: search_key,
 	                when: today.toISOString(),
 	            }, function(error, res) {
 	                    if (error)
 	                        console.log(error);
 	                    console.log(res);
 	                    db.close();
 	            });
 	      }
    });
}

function retrieveFromDB(response){
        var temp = [];
        myDBClient.connect(myDBUrl, function(err, db) {
 	      if (err)
 	        console.log('Unable to connect to the mongoDB server. Error:', err);
 	      else {        
 	        var collection = db.collection('recentSearch');
            collection.find().sort({_id:-1}).limit(10).toArray(function (err, result) {
                if (err) {
                    console.log(err);
                }else if (result.length) {
                    result.forEach(function(val,ind,arr){
                        temp.push({term : val.term.replace(/\%20/g," "), when: val.when});
                        console.log(val);
                    });
                       response.send(temp);
                }
            });
           }
           db.close();
        });
}

function isEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return true && JSON.stringify(obj) === JSON.stringify({});
}
