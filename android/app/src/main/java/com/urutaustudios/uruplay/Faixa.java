package com.urutaustudios.uruplay;

import java.io.File;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

/** Lê o cabeçalho HTTP "Range" e abre só o pedaço pedido do arquivo. */
final class Faixa {
    final long ini;
    final long fim;
    final boolean parcial;

    private Faixa(long ini, long fim, boolean parcial) {
        this.ini = ini;
        this.fim = fim;
        this.parcial = parcial;
    }

    /** Devolve null quando a faixa pedida é impossível (responder 416). */
    static Faixa ler(String cabecalho, long total) {
        if (total <= 0) return null;
        if (cabecalho == null || !cabecalho.startsWith("bytes=")) return new Faixa(0, total - 1, false);
        String[] p = cabecalho.substring(6).split(",")[0].trim().split("-", -1);
        if (p.length != 2) return new Faixa(0, total - 1, false);
        try {
            long ini;
            long fim;
            if (p[0].isEmpty()) {
                long n = Long.parseLong(p[1]);
                if (n <= 0) return null;
                ini = Math.max(0, total - n);
                fim = total - 1;
            } else {
                ini = Long.parseLong(p[0]);
                fim = p[1].isEmpty() ? total - 1 : Math.min(Long.parseLong(p[1]), total - 1);
            }
            if (ini < 0 || ini >= total || ini > fim) return null;
            return new Faixa(ini, fim, true);
        } catch (NumberFormatException e) {
            return new Faixa(0, total - 1, false);
        }
    }

    long tamanho() {
        return fim - ini + 1;
    }

    InputStream abrir(File arq) throws IOException {
        final FileInputStream in = new FileInputStream(arq);
        long pulado = 0;
        while (pulado < ini) {
            long n = in.skip(ini - pulado);
            if (n <= 0) {
                in.close();
                throw new IOException("não consegui posicionar no arquivo");
            }
            pulado += n;
        }
        final long[] resta = { tamanho() };
        return new FilterInputStream(in) {
            @Override
            public int read() throws IOException {
                if (resta[0] <= 0) return -1;
                int b = super.read();
                if (b >= 0) resta[0]--;
                return b;
            }

            @Override
            public int read(byte[] b, int off, int len) throws IOException {
                if (resta[0] <= 0) return -1;
                int n = super.read(b, off, (int) Math.min(len, resta[0]));
                if (n > 0) resta[0] -= n;
                return n;
            }
        };
    }
}
