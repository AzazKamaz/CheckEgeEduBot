FROM node:12-alpine

RUN useradd bot
USER bot

WORKDIR /opt/bot

ADD package.json ./
ADD yarn.lock ./

RUN yarn

ADD src ./src/
RUN mkdir storage

CMD node src/index.js