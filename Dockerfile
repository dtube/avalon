FROM node:14.0.0

EXPOSE 6001
EXPOSE 3001

VOLUME ~/avalon/mongodb /var/lib/mongodb

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

LABEL "project.home"="https://github.com/nannal/avalon"
RUN git clone git://github.com/dtube/avalon
WORKDIR /avalon
RUN npm install
RUN npm install --save axios

RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
RUN . ~/.bashrc


# Set debconf to run non-interactively
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Install base dependencies
RUN apt-get update && apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        git \
        libssl-dev \
        wget \
    && rm -rf /var/lib/apt/lists/*

RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | apt-key add -
RUN echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-4.4.list
RUN apt-get -y update && apt-get install -y libcurl3 openssl vim tmux mongodb


# Install nvm with node and npm
ENV NVM_DIR /root/.nvm
ENV NODE_VERSION v14.0.0
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/v$NODE_VERSION/bin:$PATH

COPY ./scripts/start_dtube.sh ./scripts/start_dtube.sh
COPY ./scripts/start_mainnet.sh ./scripts/start_mainnet.sh
COPY ./scripts/restartMining.js .

CMD ["sh"]
