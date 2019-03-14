FROM node:latest
LABEL "project.home"="https://github.com/nannal/avalon"
RUN git clone git://github.com/skzap/avalon
WORKDIR /avalon
RUN npm install
EXPOSE 6001
EXPOSE 3001
ENV DB_URL 'mongodb://localhost:27017'
ENV DB_NAME 'avalon'
ENV NODE_OWNER 'default user'
ENV NODE_OWNER_PUB 'Invalid Key'
ENV NODE_OWNER_PRIV 'Invalid Key'
ENV PEERS 'ws://api.avalon.wtf:6001,ws://avalon.nannal.com:6001,ws://82.66.109.22:6001'
CMD ["npm", "start"]
