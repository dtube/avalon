#!/bin/bash

if [ -e /dump/*.tar.gz ]; then
  mkdir -p /tmp/dump/
  cd /tmp/dump/
  tar xfz /dump/*.tar.gz
  mongo -eval "db.dropDatabase()" avalon
  mongorestore -d avalon ./
  rm -rf /tmp/dump
fi
