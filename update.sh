#!/bin/bash
# Script update wrapper yang memanggil deploy.sh
cd "$(dirname "$0")"
bash ./deploy.sh
