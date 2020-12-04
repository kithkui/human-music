const axios = require("axios");
const moment = require("moment");
const Recommendation = require("../models/recommendation");
const Day = require("../models/day");
const User = require("../models/user");
const Cycle = require("../models/cycle");
let seedDB        = require("../seeds2");
let chiita = {};

let nowTime, systemStatus, delay;

// FOR GETTING THE VIDEO INFORMATION
chiita.youtube_parser = function(url){
    let regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    let match = url.match(regExp);
    return (match&&match[7].length==11)? match[7] : false;
};

chiita.getRecommendationInfo = function(url) {
    videoID = youtube_parser(url);
    keyAPI = process.env.YOUTUBE_APIKEY;
    urlRequest = "https://www.googleapis.com/youtube/v3/videos?id="+videoID+"&key="+keyAPI+"%20&fields=items(id,snippet(title,description),contentDetails(duration,%20regionRestriction),statistics)&part=snippet,contentDetails,statistics"
    const getVideoInfo = () =>{
        try {
            return axios.get(urlRequest);
        } catch (error) {
            console.error(error)
        }
    }

const showInfo = async () => {
    const information = getVideoInfo()
    .then(response => {
        if (response.data){
            let videoData = JSON.parse(JSON.stringify(response.data))
            let durationISO = videoData.items[0].contentDetails.duration;
            let videoTitle = videoData.items[0].snippet.title;
            let durationInSeconds = (moment.duration(durationISO, moment.ISO_8601)).asSeconds();
            return [videoTitle, durationInSeconds]
        }
    })
    .catch(error => {
        console.log(error)
    })
    }
}

//BIG BANG!
chiita.bigBang = () => { //Starts the platform from the beginning. 
    Day.deleteMany({},function(err){if(err){console.log(err);}});  
    Recommendation.deleteMany({},function(err){if(err){console.log(err);}});  
    User.deleteMany({},function(err){if(err){console.log(err);}});  
    Cycle.deleteMany({},function(err){if(err){console.log(err);}});  
    seedDB();
    setTimeout(function(){
        console.log("' .     .    .              .'... The big bang happened. Emptyness. Void. Action");
    }, 1000);
    setTimeout(()=>{
        chiita.createNewDay();
    }, 2000)
}

chiita.bigBangTwo = () => { //Throws all the recommendations to he future
    Day.deleteMany({},function(err){if(err){console.log(err);}});  
    Recommendation.find({})
    .then((foundRecommendations) => {
        foundRecommendations.forEach((recommendation)=>{
            recommendation.status = "future"
            recommendation.save();
        });
        console.log("All the recommendations were sent to the future");
    })
    .catch(()=>{
        console.log("There was an error in the bigBangTwo function");
    })
}

//This is a backup function that is helpful for when the thread of setTimeouts was cut in the middle.It exists for fixing non continuities of the server.
chiita.timeWarp = async () => {
    console.log("inside the timeWarp function");
    let j = 0;
    let k = 0;
    let startingTimestamp, recommendationDuration, thisRecommendation, now;
    Day.findOne({status:"present"}).populate("recommendationsOfThisDay")
    .then((presentDay) => {
        if(presentDay){
            for(i=presentDay.elapsedRecommendations; i<presentDay.totalRecommendationsOfThisDay;i++){
                now = (new Date).getTime();
                thisRecommendation = presentDay.recommendationsOfThisDay[i];
                startingTimestamp = thisRecommendation.startingRecommendationTimestamp;
                recommendationDuration = thisRecommendation.duration;
                if(thisRecommendation.status === "present" || thisRecommendation.status === "inTheLimbo"){
                    if (now>startingTimestamp){
                        if (now-startingTimestamp < recommendationDuration){
                            let remainingTimeForNextInterval = startingTimestamp + recommendationDuration - now;
                            if(thisRecommendation.status === "present"){
                                chiita.changeSystemStatus("recommendation");
                                console.log("The recommendation was already in the present, it won't be changed")
                                console.log("1: A setTimeout will start now and it will be triggered in: " + remainingTimeForNextInterval);
                                setTimeout(chiita.startRecommendationInterval, remainingTimeForNextInterval);
                            } else {
                                thisRecommendation.status = "present"
                                thisRecommendation.save(()=>{
                                    chiita.changeSystemStatus("recommendation");
                                    console.log("The recommendation was brought to the present from the future");
                                    console.log("2: A setTimeout will start now and it will be triggered in: " + remainingTimeForNextInterval);
                                    setTimeout(chiita.startRecommendationInterval, remainingTimeForNextInterval);
                                });
                                j++;
                            }
                            presentDay.elapsedRecommendations = i;
                            break
                        } else {
                            thisRecommendation.status = "past"
                            thisRecommendation.save(()=>{
                                console.log("The recommendation was sent to the past")
                            });
                            j++;
                            k++;
                        }
                    } else {
                        if(presentDay.elapsedRecommendations < presentDay.totalRecommendationsOfThisDay) {
                            let remainingTimeForNextRecommendation = startingTimestamp - now;
                            chiita.changeSystemStatus("void");
                            console.log("We are in the void. The next recommendation will be brought to the present in " + remainingTimeForNextRecommendation + " seconds");
                            setTimeout(chiita.bringRecommendationToPresent, remainingTimeForNextRecommendation, thisRecommendation)
                        } else if (presentDay.elapsedRecommendations === presentDay.totalRecommendationsOfThisDay) {
                            chiita.changeSystemStatus("endOfDay");
                            console.log("We are in the end of day; the new day will start soon");
                        }
                        break
                    }
                } 
            }
            presentDay.elapsedRecommendations += k;
            presentDay.save( ()=> {
                console.log("The timewarp updated " + j + " recommendation's status");
                console.log("The timewarp updated the elapsed recommendations in " + k + " recommendations");
            });
        } else {
            console.log("There was not any day in the present when the timeWarp function was triggered");
        }
    })
    .catch(()=>{
        console.log("There was an error in the timeWarp function"); 
    })
}

//For managing how days get changed
chiita.sendRecommendationToPast = (presentRecommendation) => {
    presentRecommendation.status = "past";
    presentRecommendation.save(()=>{
        let now = (new Date).getTime();
        let difference = now - (presentRecommendation.startingRecommendationTimestamp + presentRecommendation.duration);
        console.log("The recommendation was sent to the past, and the difference between the supposed timestamp and the actual is: " + difference);
    })
}

chiita.bringRecommendationToPresent = (futureRecommendation) => {
    futureRecommendation.status = "present";
    futureRecommendation.save(()=>{
        let now = (new Date).getTime();
        let difference = now - futureRecommendation.startingRecommendationTimestamp;
        chiita.changeSystemStatus("recommendation");
        console.log("The recommendation was brought to the present, and the difference between the suposed timestamp and the actual one is: " + difference);
        console.log("The setTimeout starts now and lasts " + futureRecommendation.duration + " milliseconds, which is the duration of the recommendation that was brought to the present")
        delay = futureRecommendation.startingRecommendationTimestamp + futureRecommendation.duration - now;
        setTimeout(()=>{
            chiita.startRecommendationInterval();
        }, delay);
    })
}

chiita.startRecommendationInterval = () => {
    nowTime = new Date();
    Day.findOne({status:"present"}).populate("recommendationsOfThisDay")
    .then((presentDay)=>{
        chiita.sendRecommendationToPast(presentDay.recommendationsOfThisDay[presentDay.elapsedRecommendations])
        presentDay.elapsedRecommendations ++;
        presentDay.systemStatus = "void";
        console.log("The startRecommendationInterval started at: " + nowTime);
        presentDay.save(()=>{
            console.log("The day was saved with the update of the elapsed recommendations ++ and the status to void")
            if ( presentDay.elapsedRecommendations < presentDay.totalRecommendationsOfThisDay ){
                console.log("The setTimeout of the interval will start now and the duration is (chi): " + presentDay.chiDurationForThisDay);
                setTimeout(() => {
                    chiita.bringRecommendationToPresent(presentDay.recommendationsOfThisDay[presentDay.elapsedRecommendations])
                }, presentDay.chiDurationForThisDay);
            } else if ( presentDay.elapsedRecommendations === presentDay.totalRecommendationsOfThisDay ) {
                console.log("The last recommendation went through and now we are waiting for the new day to arrive. It will be created automatically");
                chiita.changeSystemStatus("endOfDay");
            }
        });
    })
    .catch(()=>{
        console.log("There was an error in the startRecommendationIntervalFunction!")
    })
}

//For managing everything related to building the presents

chiita.sendDayToPast = () => {
    Day.findOne({status:"present"}).populate("recommendationsOfThisDay")
    .then((foundDay)=>{
        if(!foundDay){
            console.log("There was not a day in the present!");
            return
        } else {
            foundDay.status = "past";
            foundDay.systemStatus = "past";
            foundDay.save(()=>{
                console.log("The day "+ foundDay.daySKU +" was sent to the past")
            })
        }
    })
    .catch(()=>{
        console.log("There was an error in the sendDayToPast function")
    })
}

let timeInDay = 86400000;
// let timeInDay = 160000;

chiita.createNewDay = async () => {
    chiita.sendDayToPast();
    let information = await chiita.bringMusicFromTheFuture();
    let dayIndex = await chiita.getPresentDay();
    if(information){
        let totalRecommendationsOfThisDay = information.numberOfRecommendations;
        let now = new Date();
        let daySKU = changeDateFormat(now);
        let startingDayTimestamp = now.getTime();
        let elapsedDaytime = 0;
        let recommendationsOfThisDay = [];
        let recommendationDurationsOfThisDay = [];
        for (let i=0; i<information.musicForToday.length;i++) {
            recommendationsOfThisDay.push(information.musicForToday[i]);
            recommendationDurationsOfThisDay.push(information.musicForToday[i].duration);
            elapsedDaytime += information.musicForToday[i].duration;
        }
        let chiDurationForThisDay = Math.floor((timeInDay-elapsedDaytime)/totalRecommendationsOfThisDay);
        let newDay = new Day({
            dayIndex : dayIndex,
            startingDayTimestamp : startingDayTimestamp,
            status : "present",
            systemStatus : "recommendation",
            daySKU : daySKU,
            cycleStatus : "active",
            totalRecommendationsOfThisDay : totalRecommendationsOfThisDay,
            elapsedRecommendations : 0,
            chiDurationForThisDay : chiDurationForThisDay,
            recommendationsOfThisDay : recommendationsOfThisDay,
            recommendationDurationsOfThisDay : recommendationDurationsOfThisDay,
        });
        let recommendationTimestamps = chiita.addTimestampsToRecommendations(newDay);
        newDay.startingTimestampsOfThisDay = recommendationTimestamps;
        newDay.save(() => {
            console.log("This new day was created, the time of creation is: " + now);
            chiita.bringRecommendationToPresent(newDay.recommendationsOfThisDay[0]);
        });
    } else {
        console.log("There was an error getting the information for the new day, so a new cycle will be created");
        chiita.createNewCycle();
    }
}

chiita.addTimestampsToRecommendations = (newDay) => {
    let elapsedDayTimestamp = newDay.startingDayTimestamp;
    let dayTimestamps = [];
    newDay.recommendationsOfThisDay.forEach((recommendation)=>{
        recommendation.startingRecommendationTimestamp = elapsedDayTimestamp;
        recommendation.status = "inTheLimbo";
        dayTimestamps.push(elapsedDayTimestamp);
        recommendation.daySKU = newDay.daySKU;
        if(recommendation.type === "music"){
            recommendation.youtubeID = recommendation.url.slice(-11);
        }
        recommendation.save();
        elapsedDayTimestamp += recommendation.duration + newDay.chiDurationForThisDay;
    });
    return dayTimestamps;
}

//////////////////////////

chiita.bringMusicFromTheFuture = async () => {
    return Recommendation.find({type:"music", status:"future"})
    .exec()
    .then((foundMusicFromTheFuture) => {
        let elapsedTime = 0;
        let numberOfRecommendations = 0;
        let musicForToday = [];
        while (elapsedTime < timeInDay) {
            let randomIndex = Math.floor(Math.random() * foundMusicFromTheFuture.length);
            let randomMusicVideoFromFuture = foundMusicFromTheFuture[randomIndex];
            foundMusicFromTheFuture.splice(randomIndex, 1); //eliminate the chosen element from foundMusic (So that it doesn't repeat)
            musicForToday.push(randomMusicVideoFromFuture); //add the chosen element to the musicForToday array
            elapsedTime += randomMusicVideoFromFuture.duration; //update elapsed time of this day
            numberOfRecommendations++; //update the counter of the number of music recommendations of that day
        }
        musicForToday = musicForToday.slice(0, musicForToday.length-1);
        numberOfRecommendations--;
        return {
            musicForToday: musicForToday,
            numberOfRecommendations : numberOfRecommendations
        };
    })
    .catch((err) =>{
        console.log("An error ocurred getting the music for the new day");
    });
};

chiita.getSystemInformation = async () => {
    return Day.findOne({status:"present"}).populate("recommendationsOfThisDay")
    .exec()
    .then((presentDay) => {
        let present = {};
        let now = (new Date).getTime();
        present.systemStatus = presentDay.systemStatus;
        present.recommendation = null;
        if(presentDay.systemStatus === "recommendation"){
            let presentRecommendation = presentDay.recommendationsOfThisDay[presentDay.elapsedRecommendations];
            let delay = presentRecommendation.startingRecommendationTimestamp + presentRecommendation.duration - now;
            present.recommendation = presentRecommendation;
            present.nextEventDelay = delay;
        } else if (presentDay.systemStatus === "void") {         
            present.nextEventDelay = presentDay.startingTimestampsOfThisDay[presentDay.elapsedRecommendations] - now;
        } else if (presentDay.systemStatus === "endOfDay") {
            present.nextEventDelay = presentDay.startingDayTimestamp + 86400000 - now;
        } 
        return present;
    })
}

chiita.changeSystemStatus = (newStatus) => {
    Day.findOne({status:"present"})
    .then((foundDay)=>{
        foundDay.systemStatus = newStatus;
        foundDay.save();
    })
}

chiita.getPresentDay = async () => {
    return Day.find().exec()
    .then ((foundDays) => {
        return foundDays.length
    });
}

chiita.addYoutubeIDs = async () => {
    Recommendation.find({type:"music"}) 
    .then((foundRecommendations) => {
        foundRecommendations.forEach((recommendation)=>{
            recommendation.youtubeID = recommendation.url.slice(-11);
            recommendation.save(()=>{
                console.log("The youtube ID was added: " + recommendation.youtubeID);
            })
        })
    })
}

//For troubleshooting and understanding if it works properly or not
chiita.evaluateTimestamps = () => {
    Day.findOne({status:"present"})
    .then((foundDay) => {
        let sum = foundDay.startingDayTimestamp
        for (i=0; i<foundDay.startingTimestampsOfThisDay.length;i++){
            if (sum === foundDay.startingTimestampsOfThisDay[i]){
                console.log("This one matches " + i);
            } else {
                console.log("This one doesn't match: " + i);
            }
            sum += foundDay.recommendationDurationsOfThisDay[i] + foundDay.chiDurationForThisDay;
        }
        console.log("At the end, the sum is: " + sum);
    })
}

chiita.createNewCycle = () => {
    //This function has to run whenn the system searches for new recommmendations in the future and it fails. If there is no more recommendations
    //to create a new day the system should save what has happened in that given cycle and record it in the history. 
    console.log("inside the createNewCycle function");
    let newCycle = new Cycle();
    Cycle.find({})
    .then((foundCycles)=>{
        if(foundCycles.length === 0) {
            newCycle.cycleIndex = 0;
        } else {
            newCycle.cycleIndex = foundCycles.length;
        }
        Day.find({cycleStatus : "active"})
        .then((foundActiveDays)=>{
            newCycle.cycleDuration = foundActiveDays.length;
            newCycle.daysOfThisCycle = foundActiveDays;
            newCycle.save(()=>{
                console.log("The new cycle was created, and now all the recommendations are going to be sent to the future");
                Recommendation.find({})
                .then((foundRecommendations)=>{
                    foundRecommendations.forEach((recommendation)=> {
                        recommendation.status = "future";
                        recommendation.save();
                    });
                })
            })
            foundActiveDays.forEach((activeDay)=>{
                activeDay.cycleStatus = "inactive";
                activeDay.save();
            })
        })
        .then(()=>{
            console.log("After sending all the recommendations to the future and creating the new cycle, a new day will be created now: ");
            setTimeout(chiita.createNewDay, 500);
        })
    })
}

//Functions for date format for the new day

function changeDateFormat(date){
    let formatedDate = "";
    let day = (date.getDate()<10) ? "0" + date.getDate() : date.getDate();
    formatedDate += day;
    formatedDate += date.getFullYear();
    formatedDate += romanize(date.getMonth()+1);
    return formatedDate;
}

function romanize (num) {
    if (isNaN(num))
        return NaN;
    let digits = String(+num).split(""),
        key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
               "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
               "","I","II","III","IV","V","VI","VII","VIII","IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}

chiita.changeDateFormat = (date) => {
    let formatedDate = "";
    let day = (date.getDate()<10) ? "0" + date.getDate() : date.getDate();
    formatedDate += day;
    formatedDate += date.getFullYear();
    formatedDate += romanize(date.getMonth()+1);
    return formatedDate;
}

module.exports = chiita;