const functions = require("firebase-functions");
// Imports the Google Cloud client library
const language = require('@google-cloud/language');
const vision = require("@google-cloud/vision");

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
const { json } = require("express");
admin.initializeApp(functions.config().firebase);

const imageAnnotatorClient = new vision.ImageAnnotatorClient();
const languageServiceClient = new language.LanguageServiceClient();

exports.analyzeImage = functions.region('europe-west3').https.onCall(async (data) => {
  try {
    const result = await imageAnnotatorClient.annotateImage(JSON.parse(data));
    const processed_text = result[0].fullTextAnnotation.text;
    let myObj = new Object();
    myObj.processed_text = processed_text;
    if(processed_text == null){
      return JSON.stringify(processed_text);
    }

    const pages = result[0].fullTextAnnotation.pages
    let nLines = 0;
    let nWords = 0;

    for (page in pages) {
      for (block in pages[page].blocks) {
        for (para in pages[page].blocks[block].paragraphs) {
          for (word in pages[page].blocks[block].paragraphs[para].words) {
              nWords += 1;
          }
          nLines += 1;
        }
      }
  }
  
  myObj.nLines = nLines;
  myObj.nWords = nWords;

  return JSON.stringify(myObj);
  } catch (e) {
    throw new functions.https.HttpsError("internal", e.message, e.details);
  }
});

exports.analyzeTextTrigger_OnCreate = functions.region('europe-west3').firestore
  .document("DocumentCollection/{docId}")
  .onCreate(async (change, context) => {
  const text = change.data().processed_text
  // Creates a client
  const document = {
      "content": text,
      "type": 'PLAIN_TEXT',
    };
  const sentimentResult = await languageServiceClient.analyzeSentiment({document});
  const categoryResult = await languageServiceClient.classifyText({document})
  const sentimentScore = sentimentResult[0].documentSentiment.score
  const sentimentMagnitude = sentimentResult[0].documentSentiment.magnitude
  const classification = categoryResult[0].categories
 
  let res;
  for (i in classification){
    if (i == 0)
      res += classification[i].name + ": " + (parseFloat(classification[i].confidence)*100).toFixed(2) + "%";
    else
      res += "\n" + classification[i].name + ": " + (parseFloat(classification[i].confidence)*100).toFixed(2) + "%";
  }

  res = res.replace("undefined/", "")

  return change.ref.update({
    sentiment: sentimentScore,
    sentimentMagnitude: sentimentMagnitude,
    classification: res
  }, {merge: true});
});

exports.analyzeTextTrigger_OnUpdate = functions.region('europe-west3').firestore
  .document("DocumentCollection/{docId}")
  .onUpdate(async (change, context) => {
  const text = change.after.data().processed_text
  // Creates a client
  const document = {
      "content": text,
      "type": 'PLAIN_TEXT',
    };
  const sentimentResult = await languageServiceClient.analyzeSentiment({document});
  const categoryResult = await languageServiceClient.classifyText({document})
  const sentimentScore = sentimentResult[0].documentSentiment.score
  const sentimentMagnitude = sentimentResult[0].documentSentiment.magnitude
  const classification = categoryResult[0].categories

  let res;
  for (i in classification){

    if (i == 0)
      res += classification[i].name + ": " + (parseFloat(classification[i].confidence)*100).toFixed(2) + "%";
    else
      res += "\n" + classification[i].name + ": " + (parseFloat(classification[i].confidence)*100).toFixed(2) + "%";
  }
  
  res = res.replace("undefined/", "")

  return change.after.ref.update({
    sentiment: sentimentScore,
    sentimentMagnitude: sentimentMagnitude,
    classification: res
  }, {merge: true});
});
