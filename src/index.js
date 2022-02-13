import * as axios from 'axios';
import * as core from '@actions/core';
import * as github from '@actions/github';

const { context = {} } = github;
const { pull_request, head_commit } = context.payload;

const CARD_ID_PATTERN = /^https:\/\/trello.com\/c\/([a-zA-Z0-9]{8})/g;
const TRELLO_API_KEY = core.getInput('trello-api-key', { required: true });
const TRELLO_AUTH_TOKEN = core.getInput('trello-auth-token', { required: true });
const TRELLO_BOARD_REOPEN_LIST_ID = core.getInput('trello-board-reopen-list-id', { required: false });
const TRELLO_BOARD_NEEDS_CODE_REVIEW_LIST_ID = core.getInput('trello-board-needs-code-review-list-id', { required: false });
const TRELLO_BOARD_NEEDS_ACCEPTATION_LIST_ID = core.getInput('trello-board-needs-acceptation-list-id', { required: false });

function getCardID(message) {
  console.log(`getCardID(${message})`);
  if (CARD_ID_PATTERN.test(message)) {
      CARD_ID_PATTERN.lastIndex=0;
      let cardId = CARD_ID_PATTERN.exec(message)[1];
      console.log(`Unique card's ID is ${cardId}`);
      return cardId;  
  }
  else {
    console.log(`Message ${message} doesn't begin on card's short link`);
    return null;
  }
  
}

async function isLinkAttachedToCard(card, link) {
  console.log(`isPullRequestAttachedToCard(${card}, ${link})`);
  let url = `https://api.trello.com/1/cards/${card}/attachments`;

  return await axios.get(url, {
    params: {
      key: trelloApiKey,
      token: trelloAuthToken
    }
  }).then(response => {
    return response.data.findIndex(v => v.url === link) != -1;
  }).catch(error => {
    console.error(url, `Error ${error.response.status} ${error.response.statusText}`);
    return false;
  });
}

async function addAttachmentToCard(card, link) {
  console.log(`addAttachmentToCard(${card}, ${link})`);
  if (isLinkAttachedToCard(card, link)) {
    // Don't want to duplicate link in card
    return null;
  }
  let url = `https://api.trello.com/1/cards/${card}/attachments`;
  return await axios.post(url, {
    key: TRELLO_API_KEY,
    token: TRELLO_AUTH_TOKEN, 
    url: link
  }).then(response => {
    return response.status == 200;
  });
}

async function moveCardToList(board, card, listId) {
  console.log(`moveCardToList(${board}, ${card}, ${listId})`);
    let url = `https://api.trello.com/1/cards/${card}`;
    return await axios.put(url, {
      key: TRELLO_API_KEY,
      token: TRELLO_AUTH_TOKEN, 
      idList: listId
    }).then(response => {
      return response && response.status == 200;
    });
}

async function handleHeadCommit(data) {
  console.log("handleHeadCommit", data);
  let url = data.url;
  let message = data.message;
  let user = data.author.name;
  let card = await getCardID(message);
  if (card) {
    await addAttachmentToCard(card, url);
  }
}

async function handlePullRequest(data, actionType) {
  console.log("handlePullRequest", data, actionType);
  let url = data.html_url || data.url;
  let message = data.title;
  let user = data.user.name;
  let card = await getCardID(message);
  if (card) {
    await addAttachmentToCard(card, url);
    if (TRELLO_BOARD_REOPEN_LIST_ID && actionType == "reopened" ) {
      await moveCardToList(card, TRELLO_BOARD_REOPEN_LIST_ID);
    }
    else if (TRELLO_BOARD_NEEDS_CODE_REVIEW_LIST_ID && actionType == "opened" ) {
      await moveCardToList(card, TRELLO_BOARD_NEEDS_CODE_REVIEW_LIST_ID); 
    }
    else if (TRELLO_BOARD_NEEDS_ACCEPTATION_LIST_ID && actionType == "closed" ) {
      await moveCardToList(card, TRELLO_BOARD_NEEDS_ACCEPTATION_LIST_ID);
    }  
  }
  
}

async function run() {

  try {
    console.log("Run context", context);
    if (head_commit && head_commit.message) {
      handleHeadCommit(head_commit)
    }
    else if (pull_request && pull_request.title) {
      handlePullRequest(pull_request, context.payload.action)
    }
  }
  catch (error) {
    core.setFailed(error.message);
  }
  
};

run()