#!/usr/bin/bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
alias npm='~/.local/share/pnpm/pnpm'
echo alias npm='~/' >> $HOME/.bashrc