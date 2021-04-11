let matchAreas = document.querySelectorAll(".matchArea")
let matches = document.querySelectorAll(".match .matchBody")
let timeArea = document.querySelector(".timeArea");
let timeModel = document.querySelector(".time").cloneNode(true);
let resizers = document.querySelectorAll(".matchResize")
window.allTimeUnits = [5,10,15,30]
window.availableHours = [12,1,2];
window.zoomLevel = window.smallestZoomLevel = 5;
window.allBreakPoints = [];

matches.forEach(match => {
    match.addEventListener("dragstart",(e)=>{
        //check if user wanna resize or just move
        let match = e.target.parentElement;
        e.dataTransfer.setData('application/json',JSON.stringify({
            type:"match",
            matchId: match.dataset.matchId,
            offsetX:e.offsetX,
            offsetY:e.offsetY
        }))
    })
})

resizers.forEach(resEl => {
    resEl.addEventListener("dragstart",(e)=>{
        //check if user wanna resize or just move
        let match = e.target.parentElement;
        e.dataTransfer.setData('application/json',JSON.stringify({
            type:"resize",
            matchId: match.dataset.matchId
        }))
    })
    resEl.addEventListener("drag",(e)=>{
        //being dragged
        let match = e.target.parentElement;
        let newWidth = e.screenX - match.getBoundingClientRect().left;
        if(newWidth > 0){
            match.querySelector(".matchBody").style.width = newWidth + "px";
        }else{
            console.error("width error found...")
        }
    })

    resEl.addEventListener("dragend",(e)=>{
        debugger;

        let matchEl = e.target.parentElement;

        let closestBreakPoint = window.allBreakPoints.reduce(function(prev,cur){
            return (Math.abs(cur-e.target.getBoundingClientRect().left) < Math.abs(prev-e.target.getBoundingClientRect().left) ? cur : prev)
        })

        matchEl.dataset.matchLength = (getTimeInUnits(closestBreakPoint) - (+matchEl.dataset.startTime))/window.smallestZoomLevel;
        
        updatePositionAndWidth([matchEl]);
    })
})

matchAreas.forEach(matchArea => {
    matchArea.addEventListener("dragover",(e)=>{
      e.preventDefault();  
    })
    matchArea.addEventListener("drop",(e)=>{
        let dragData = JSON.parse(e.dataTransfer.getData("application/json"))
        if(dragData.type == "match"){
            //make sure the data is not from resizer
            if(!e.target.classList.contains("matchResize")){
                //check if the match will be placed out of dropMatch area or not
                let left = e.offsetX - dragData.offsetX;
                let matchEl = document.querySelector(".match[data-match-id='"+dragData.matchId+"']")
                let target = e.target.classList.contains("matchBody") ? e.target.parentElement : e.target;
                if(validateDragDrop({
                    dragData,e,left,matchEl
                })){
                    if(matchEl && target && (target.classList.contains("matchArea") || (target.classList.contains("match") && target === matchEl))){
                        matchArea.appendChild(matchEl);
                        matchEl.style.left = (target === matchEl ? (matchEl.offsetLeft + left) : left) +"px"
                        /////////////////////working on time + match
                        setMatchTime(matchEl);
                    }
                }
            }
        }
    })
})

function validateDragDrop(data){
    debugger;
    let decision = true;
    //check if the match will be placed out of dropMatch area or not
    if(data.e.offsetX - data.dragData.offsetX < 0 && data.matchEl !== data.e.target && data.matchEl.querySelector(".matchBody") !== data.e.target){
        decision = false;
    }

    //check if the match will be placed over another match
    let allMatchesInArea = data.e.target == data.matchEl ? data.matchEl.parentElement : data.e.target.querySelectorAll(".match")
    let targetMatchLeft = (data.e.screenX-data.dragData.offsetX);
    let targetMatchRight = targetMatchLeft + data.matchEl.getBoundingClientRect().width;
    Array.from(allMatchesInArea).some(m => {
        debugger;
        if(decision == true && (m !== data.matchEl)){
            let l = +m.style.left.replace("px","");
            l = l == "" ? 0 : l;
            let r = m.getBoundingClientRect().width + l;
            if(isBetween(targetMatchLeft,l,r) || isBetween(targetMatchRight,l,r) || isBetween(l,targetMatchLeft,targetMatchRight) || isBetween(r,targetMatchLeft,targetMatchRight)){
                decision = false;
                return true;
            }
        }
    })

    return decision;
}

/* sets the match's time on dropping it somewher
* matchEl - Match DOM Element
* left - the position where user dragged it
*/
function setMatchTime(matchEl){
    let matchPos = matchEl.getBoundingClientRect().left;
    //check if it exactly matches a breakpoint
    let extaclySame = Array.from(document.querySelectorAll(".time")).filter((m)=>{
        return m.getBoundingClientRect().left == matchPos;
    })
    if(extaclySame.length > 0){
        matchEl.dataset.startTime = extaclySame[0].dataset.time;
    }else{
        let breakPointsPerTime = (+window.zoomLevel/+window.smallestZoomLevel); //e.g 15 minutes will have 3 breakpoints (although these breakpoints are not visible by a line/bar) if smallestZoomLevel is 5 minutes
        
        // //getting closest breakpoint
        let closestBreakPoint = window.allBreakPoints.reduce(function(prev,cur){
            return (Math.abs(cur-matchPos) < Math.abs(prev-matchPos) ? cur : prev)
        })

        matchEl.dataset.startTime = getTimeInUnits(closestBreakPoint);

        updatePositionAndWidth([matchEl]);

    }
}

// get all break points (visisble and non visible)
function getAllBreakPoints(){
    let breakPointsPerTime = (+window.zoomLevel/+window.smallestZoomLevel);
    let allBreakPoints = [];
    let allBreakPointElements = document.querySelectorAll(".time");
    allBreakPointElements.forEach((timeEl,index) => {
        // allBreakPoints.push(timeEl.getBoundingClientRect().x);
        allBreakPoints = allBreakPoints.concat(getInRangeBreakPoints(timeEl.getBoundingClientRect().x,(allBreakPointElements[index+1] ? allBreakPointElements[index+1].getBoundingClientRect().x : undefined),breakPointsPerTime))
    })

    //remove duplicates and undefined
    allBreakPoints = allBreakPoints.filter(function(item,index){return allBreakPoints.indexOf(item) == index && item !== undefined})

    return allBreakPoints;
}

//get match time for a breakpoint - breakpoint should be in pixel
function getTimeInUnits(breakPoint){
    let matchedBreakPointIndex = window.allBreakPoints.findIndex(function(bp){
        return bp == breakPoint
    })
    if(matchedBreakPointIndex !== -1){
        return (matchedBreakPointIndex)*window.smallestZoomLevel
    }else{
        return null;
    }
}

//get break point by calculating the unit time
function getBreakPointFromTime(unitTime){
    let matchedBreakPoint = window.allBreakPoints.filter(function(bp,i){
        return (i)*window.smallestZoomLevel == unitTime;
    })
    if(matchedBreakPoint.length > 0){
        return matchedBreakPoint[0];
    }
}



/*
* area - the time parent div
* model - cloned model of a single time element
* unit - time units , used to zoom
* oldUnit - unit before updating it (used to position matches correctly)
*/
function processTime(area,model,unit){
    area.innerHTML = "";
    //used to set time according to unit e.g 12:00 AM is 0 unit time, 12:30 AM is 6 unit time (if unit is 5)
    let unitTime = unit;
    window.availableHours.forEach(hour => {
        for(let i=0;i<=55;i = i+unit){
            let newTimeEl = model.cloneNode(true);

            //set global
            window.zoomLevel = unit;
            
            //width per unit
            switch(unit){
                case 5:
                    newTimeEl.style.width = "128px";
                    break;
                    case 10:
                    newTimeEl.style.width = "64px";
                    break;
                    case 15:
                    newTimeEl.style.width = "32px";
                    break;
                    case 30:
                    newTimeEl.style.width = "16px";
                    break;
                    default:
                        newTimeEl.style.width = "128";
                        break;
                    }
                                
            //if first element then add margin left
            if(area.childElementCount <= 0){
                newTimeEl.classList.add("ml-4")
            }
            //check if gives remainder of zero with (timeunit*2) then it means it will be big line
            if(i%(unit*2) == 0){
                newTimeEl.querySelector(".timeBar").classList.add("h-6")
                newTimeEl.querySelector(".timeText").innerHTML = fixDoubleInteger(hour)+":"+fixDoubleInteger(i);
            }else{
                newTimeEl.querySelector(".timeBar").classList.add("h-4")
            }
            //setting time according to unit
            newTimeEl.dataset.time = unitTime - unit
            unitTime += unit;
            
            area.appendChild(newTimeEl)
        }
    })
    window.allBreakPoints = getAllBreakPoints();
    updatePositionAndWidth();
}

processTime(timeArea,timeModel,window.zoomLevel);


document.getElementById("zoomIn").addEventListener("click",()=>{
    let oldZoomIndex = window.allTimeUnits.findIndex((u) => u == window.zoomLevel)
    
    //if it has reached limit
    if(oldZoomIndex > 0){
        window.zoomLevel = window.allTimeUnits[oldZoomIndex-1]
        
        processTime(timeArea,timeModel,window.zoomLevel,oldZoomIndex);
        
    }
})
document.getElementById("zoomOut").addEventListener("click",()=>{
    let oldZoomIndex = window.allTimeUnits.findIndex((u) => u == window.zoomLevel)
    
    //if it has reached limit
    if(oldZoomIndex < (window.allTimeUnits.length-1)){
        window.zoomLevel = window.allTimeUnits[oldZoomIndex+1]

        processTime(timeArea,timeModel,window.zoomLevel,oldZoomIndex);
        
    }
})

// find if a number if between the other 2 numbers or not
function isBetween(number,a,b){
    if((number < a && number > b) || (number > a && number < b)){
        return true;
    }else{
        return false;
    }
}


//adds a zero to right of numbers below 10 e.g 5 to 05
function fixDoubleInteger(val){
    return (val).toLocaleString("en-US",{minimumIntegerDigits:2,useGrouping:false})
}

//check if the time element is AM or PM
function getAMPM(timeEl){
    return timeEl.parentElement.previousElementSibling.innerText == "AM" ? "AM" : "PM";
}

function processWidth(matchEl,leftBreakPoint,rightBreakPoint){
        matchEl.querySelector(".matchBody").style.width = ((rightBreakPoint - leftBreakPoint)) + "px";
}


// get break points between bars using pixels value that (including invisible breakpoints)
function getInRangeBreakPoints(start,end,breakPoints = 1){
    if(start && end){
        let pixelsPerBreakPoint = (end - start)/breakPoints;
        //get in range beakpoints (visible and non visible)
        let inRangebreakPoints = [start];
        for(let i=1;i<breakPoints;i++){
            inRangebreakPoints.push(inRangebreakPoints[inRangebreakPoints.length-1]+pixelsPerBreakPoint);
        }
        inRangebreakPoints.push(end);
        return inRangebreakPoints;
    }
}

function updatePositionAndWidth(matches = null){
    matches = matches ?? document.querySelectorAll(".match")
    matches.forEach(match => {
        //because we will only position it with left side, on getting right side we will set width according to that side
            let leftBreakPoint = Math.floor(getBreakPointFromTime(+match.dataset.startTime));
            //find parent margin left used to make sure match does not go outside range
            let parentMarginLeft = Array.from(document.querySelector(".match").parentElement.classList).filter((x)=>{return x.includes("pl");})
            if(parentMarginLeft.length > 0){
                let remPaddingLeftValue = parentMarginLeft[0].match(/\d+/);
                parentMarginLeft = remPaddingLeftValue ? +remPaddingLeftValue[0] : 4;
                parentMarginLeft = (parentMarginLeft/4)*16;
            }else{
                parentMarginLeft = 4;
            }

            let targetBreakPoint = Number.isInteger(leftBreakPoint) ? leftBreakPoint : (match.parentElement.getBoundingClientRect().x + parentMarginLeft);
            while(match.getBoundingClientRect().x !== targetBreakPoint){
                //if it is not set then make it 0px by default
                match.style.left = match.style.left == "" ? "0px": match.style.left;

                let left = match.style.left.match(/\d+/);
                if(left){
                    if(match.getBoundingClientRect().x < targetBreakPoint){
                            match.style.left = ((+left[0])+1)+"px";
                    }else{
                        match.style.left = ((+left[0])-1)+"px";
                    }
                }
            }
            //process Width
            processWidth(match,leftBreakPoint,getBreakPointFromTime((+match.dataset.startTime+(+match.dataset.matchLength*5))));
    })
}

window.allBreakPoints = getAllBreakPoints();