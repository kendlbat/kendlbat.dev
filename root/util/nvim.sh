curl -o /tmp/nvim-linux64.tar.gz -L https://github.com/neovim/neovim/releases/latest/download/nvim-linux64.tar.gz
tar -xzvf /tmp/nvim-linux64.tar.gz
mv /tmp/nvim-linux64/ $HOME/nvim/
alias nvim='~/nvim/bin/nvim'
echo alias nvim='~/nvim/bin/nvim' >> $HOME/.bashrc