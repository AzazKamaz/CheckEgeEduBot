FROM node:12-alpine

WORKDIR /opt/bot

ADD package.json ./
ADD yarn.lock ./

RUN yarn

ADD src ./src/

CMD node src/index.js