FROM mongo:4.2.12

EXPOSE 6001
EXPOSE 3001

VOLUME ~/avalon/mongodb /data/db

# Set debconf to run non-interactively
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install base dependencies
RUN apt-get update && apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        git \
        libssl-dev \
        wget \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get -y update && apt-get install -y openssl vim tmux locales-all curl

# Install nvm with node and npm
ENV NVM_DIR /root/.nvm
ENV NODE_VERSION v14.0.0
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH

LABEL "project.home"="https://github.com/dtube/avalon"
RUN git clone git://github.com/dtube/avalon
WORKDIR /avalon
RUN npm install
RUN npm install --save axios
RUN echo "" > avalon.log

COPY ./scripts/start_dtube.sh ./scripts/start_dtube.sh
COPY ./scripts/start_mainnet.sh ./scripts/start_mainnet.sh
COPY ./scripts/restartMining.js .
COPY .tmux.conf /root/.tmux.conf
COPY .vimrc /root/.vimrc

CMD ["sh"]
