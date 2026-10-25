#!/usr/bin/env bash
loadkeys de
mount -o subvol=@ /dev/nvme0n1p2 /mnt
mount -o subvol=@home /dev/nvme0n1p2 /mnt/home
mount -o subvol=@pkg /dev/nvme0n1p2 /mnt/var/cache/pacman/pkg
mount -o subvol=@log /dev/nvme0n1p2 /mnt/var/log
mount -o subvol=@snapshots /dev/nvme0n1p2 /mnt/.snapshots
mount /dev/nvme0n1p1 /mnt/boot
echo "arch-chroot /mnt"
echo "pacman -S linux"