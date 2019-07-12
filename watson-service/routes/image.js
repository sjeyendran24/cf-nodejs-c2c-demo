const express = require('express');
const services = require('../services/service')

const router = express.Router();

//------------------------------------------------------------------------------
// getTags()
// Processes the raw response data from Watson and retrieves all classes with
// its labels and scores. Additonally it creates a few additional labels (face
// recognition). The tags are then sorted by score descending and if there are
// more than 6 tags, the 7 first tags (with the highest score) are selected and
// returned (else less tags).
//------------------------------------------------------------------------------
const getTags = (data) => {

    //predefining return object
    let tags = {};
    tags.data = {};
    tags.tags = [];

    try{

        //------------------------------------------------------------------------------
        // Devides data into both data sets (general and face recognition).
        // -> only the first image is selected because the application only
        //    analyses one image at a time
        //
        // ! examples of the data structure can be found in the README
        //------------------------------------------------------------------------------
        let generalData = data.general.images[0].classifiers;
        let faceData = data.faces.images[0];

        //get respective data array in both data categories (general and face)
        let defaultClasses = generalData[0].classes;
        let faces = faceData.faces;

        //------------------------------------------------------------------------------
        // Loops through all classes of the gerneral data set and pushes label and score
        // as new object into the tags array.
        //------------------------------------------------------------------------------
        defaultClasses.forEach(classObj => {
            tags.tags.push({
                label: classObj.class,
                score: classObj.score
            });
        });

        //------------------------------------------------------------------------------
        // Processes the face recognition data and generates the respective tags from
        // it which are pushed to the tags array as well
        //------------------------------------------------------------------------------

        //if the faces array has more than one item -> image contains multiple faces
        if(faces.length > 1){
            tags.tags.push({ //push to tags array
                label: "multiple faces",
                score: 1
            });
        }
        //if image contains exactly one face
        if(faces.length === 1){
            let faceProps = faces[0]; //get first (only) item from face array

            //if gender category within the face properties is available
            if(faceProps.gender){
                let genderData = faceProps.gender;
                tags.tags.push({ //push to tags array
                    label: genderData.gender_label,
                    score: genderData.score
                });
            }
            //if age category within the face properties is available
            if(faceProps.age){
                let ageData = faceProps.age;
                let ageTag = `age: ${ageData.min}-${ageData.max}`; //create custom label using the analysed age
                tags.tags.push({ //push to tags array
                    label: ageTag,
                    score: ageData.score
                });
                tags.data.age = {min: ageData.min, max: ageData.max}; //save the age data additionally into the tagData and hence into the database
            }
            tags.data.faceLocation = faceProps.face_location; //save the face_location as well
        }

        //sort the tags array by score of the tags descending (if the score of 2 tags is equal, they are ordered alphabetically)
        tags.tags.sort((a,b) => (a.score > b.score) ? -1 : (a.score === b.score) ? ((a.label > b.label) ? 1 : -1) : 1)

        //if there are more than 6 tags in the tags array
        if(tags.tags.length > 6){
            tags.tags = tags.tags.slice(0,7); //first 7 tags (highest score) are selected to be returned
        }

        return tags;
        
    }catch(err){
        console.log(err);
        return null; //return null value on error
    }
}

//------------------------------------------------------------------------------
// ROUTE: /api/image
// API Route for analysing an image (using a provided URL) and returning a list
// of tags plus additional data (age, faceLocation).
//------------------------------------------------------------------------------
router.post('/', (req, resp) => {
    let imageUrl = req.body.imageUrl; //get imageURL from request payload (body)

    //check if imageURL is missing or empty
    if(imageUrl && imageUrl !== ''){

        //------------------------------------------------------------------------------
        // Execute the analyseImage() function on the previosly initialized WatsonClient 
        // (services/service.js) -> initialization is done on server start (server.js).
        // Tags are generated using the provided data in the callback.
        //------------------------------------------------------------------------------
        services.watsonClient.analyseImage(imageUrl).then((data) => {

            let tags = getTags(data); //convert rawData to tags object
    
            //if error occurs, a null value is returned by getTags()
            if(tags !== null){
                resp.json(tags); //return successful retrieved tags
            }else{
                resp.status(500).json({}) //return empty object on error
            }

        }).catch((err) => { // <- error during watson request
            console.log(err);
            resp.status(500).json({}); //return empty object on error
        });
    }else{
        resp.status(500).send("No imageUrl was provided")
    }
});

module.exports = router;

