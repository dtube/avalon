# Be an avalon leader in minutes.
# You will be an observer node by default.

# Only top 15(may expand in tiers in future) elected nodes can mine dtube blocks on avalon chain, account @dtube excluded.
# Check Block explorer for current stats: 
      Run by leader fasolo97: https://explorer.dtube.fso.ovh/#/
      Run and created by leader techcoderx: https://avalonblocks.com/#/


Step 1.
  1-A. Install docker
    https://docs.docker.com/get-docker/

  1-B. Install docker compose
    https://docs.docker.com/compose/install/

Step 2.
  Build the avalon image using 
  docker-compose build

Step 3.
  Create avalon, mongodb, logs directory under your home directory. The total chain db stays outside of the docker in your local in this mongodb directory.
`
  mkdir -p ~/avalon/mongodb &&
  mkdir ~/avalon/blocks &&
  mkdir ~/avalon/logs
`
Step 4.
  Update .env file to set ports and other environment variables.

Step 5.
  Run the avalon container and be a observer leader.
  docker-compose up

  How to run a miner node?

Tip appreciated! Mantained by `@fasolo97`, made by `@brishtieveja0595`.

