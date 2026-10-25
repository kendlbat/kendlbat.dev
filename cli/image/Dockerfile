# Alpine root filesystem served to v86 over 9p, based on v86's tools/docker/alpine
FROM docker.io/i386/alpine:3.21.0

RUN apk add openrc alpine-base agetty alpine-conf linux-virt linux-firmware-none \
    zsh zsh-autosuggestions fastfetch less htop

RUN sed -i '/getty/d' /etc/inittab \
 && echo 'ttyS0::respawn:/sbin/agetty --autologin root --noissue -s ttyS0 115200 xterm-256color' >> /etc/inittab \
 && echo "root:" | chpasswd \
 && sed -i 's|^root:.*|root:x:0:0:root:/root:/bin/zsh|' /etc/passwd

# git and figlet are only needed while building; oh-my-zsh is trimmed to its core and the bira theme
RUN apk add --virtual .build git figlet \
 && git clone --depth 1 https://github.com/ohmyzsh/ohmyzsh /root/.oh-my-zsh \
 && cd /root/.oh-my-zsh && rm -rf .git .github plugins/* templates cache \
 && find themes -type f ! -name bira.zsh-theme -delete \
 && figlet -f slant kendlbat.dev > /etc/motd \
 && apk del .build
COPY image/zshrc /root/.zshrc
COPY image/zlogin /root/.zlogin
COPY blog/target/i686-unknown-linux-musl/release/blog /usr/local/bin/blog
RUN touch /root/.hushlogin

RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done \
 && for i in modules sysctl hostname bootmisc; do rc-update add $i boot; done \
 && rc-update add killprocs shutdown

RUN mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/virt/kernel.release) \
 && rm /boot/System.map-* /boot/config-* \
 && rm -rf /usr/share/doc /usr/share/man /var/cache/apk/*

# docker export leaves /.dockerenv behind, which makes OpenRC skip services like hostname
RUN echo 'rc_sys=""' >> /etc/rc.conf
