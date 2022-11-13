FROM mongo:6.0.2

EXPOSE 6029
EXPOSE 3029



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
	unzip \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get -y update && apt-get install -y openssl vim tmux locales-all curl

# Install nvm with node and npm
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt-get install -y nodejs

LABEL "project.home"="https://github.com/dtube/avalon"
RUN cd / && git clone https://github.com/dtube/avalon

RUN mkdir /avalon/log
RUN mkdir /avalon/genesis
RUN mkdir /avalon/blocks
WORKDIR /avalon
RUN npm install
RUN npm install --save axios
RUN echo "" > log/avalon.log

VOLUME $HOME/avalon/logs /avalon/log
VOLUME $HOME/avalon/mongodb /data/db
VOLUME $HOME/avalon/blocks /avalon/blocks

ADD ./scripts/start_dtube.sh ./scripts/start_dtube.sh
ADD ./scripts/start_mainnet.sh ./scripts/start_mainnet.sh
ADD ./scripts/restartMining.js .
COPY .tmux.conf /root/.tmux.conf
COPY .vimrc /root/.vimrc

CMD ["sh"]
