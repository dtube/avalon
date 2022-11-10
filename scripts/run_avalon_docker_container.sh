#!/bin/bash

docker build -t avalon .
# alternative: docker-compose build

sleep 5

docker rm avalon
docker run -it -v $HOME/avalon/blocks:/avalon/blocks -v $HOME/avalon/mongodb:/var/lib/mongodb -p 3001:3001 -p 6001:6001 --name avalon avalon:latest ./scripts/start_dtube.sh
# alternative: docker-compose down && docker-compose up
